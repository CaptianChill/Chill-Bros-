import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service-client";

import { centralNow, openSlotCount } from "./slots";
import { getAutopilotSettings, loadOpenSlots, type AutopilotSettings } from "./store";

// Owner's profit view for Lead Autopilot: what it sent, what it booked, and what
// those bookings turned into in invoices. Running cost is an estimate.

const EST_COST_PER_AI_EMAIL = 0.01;
const EST_COST_PER_SMS = 0.0083;

export type AutopilotBooking = { jobId: string; jobNumber: string | null; customerName: string; window: string | null; status: string; bookedAt: string; invoiced: number; paid: number };
export type AutopilotActivity = { at: string; lane: string; channel: string; recipient: string | null; subject: string | null; status: string };

export type AutopilotDashboard = {
  days: number;
  settings: AutopilotSettings;
  openSlots5Days: number;
  sent: { cold: number; reactivation: number; inbound: number; total: number };
  leads: { prospectsWithEmail: number; foundThisPeriod: number; inSequence: number; unsubscribed: number; inboundLeads: number };
  bookings: AutopilotBooking[];
  money: { bookedJobs: number; invoiced: number; paid: number; estCost: number; profitPaid: number };
  activity: AutopilotActivity[];
};

export async function getAutopilotDashboard(days = 30): Promise<AutopilotDashboard> {
  const s = createServiceRoleClient();
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const settings = await getAutopilotSettings(s);

  const [slots, { data: logs }, { data: events }, prospectsWithEmail, foundThisPeriod, inSequence, unsubscribed, inboundLeads, { data: recent }] = await Promise.all([
    loadOpenSlots(s, settings),
    s.from("chillbros_outreach_log").select("lane,channel,status").gte("created_at", since).eq("status", "sent").in("lane", ["cold", "reactivation", "inbound"]),
    s.from("chillbros_workflow_events").select("job_id,created_at").eq("stage", "online_booking").gte("created_at", since).order("created_at", { ascending: false }),
    s.from("chillbros_revenue_prospects").select("id", { count: "exact", head: true }).not("contact_email", "is", null).neq("contact_email", "").eq("do_not_contact", false),
    s.from("chillbros_revenue_prospects").select("id", { count: "exact", head: true }).gte("email_enriched_at", since).not("contact_email", "is", null).neq("contact_email", ""),
    s.from("chillbros_revenue_prospects").select("id", { count: "exact", head: true }).gt("outreach_step", 0).eq("outreach_done", false),
    s.from("chillbros_outreach_suppressions").select("contact", { count: "exact", head: true }),
    s.from("chillbros_inbound_leads").select("id", { count: "exact", head: true }).gte("created_at", since),
    s.from("chillbros_outreach_log").select("created_at,lane,channel,recipient,subject,status").neq("lane", "booking").order("created_at", { ascending: false }).limit(25),
  ]);

  const sent = { cold: 0, reactivation: 0, inbound: 0, total: 0 };
  let sms = 0;
  for (const row of logs ?? []) {
    if (row.lane === "cold" || row.lane === "reactivation" || row.lane === "inbound") sent[row.lane as "cold" | "reactivation" | "inbound"]++;
    sent.total++;
    if (row.channel === "sms") sms++;
  }

  const bookedAt = new Map<string, string>();
  for (const e of events ?? []) if (e.job_id && !bookedAt.has(e.job_id)) bookedAt.set(e.job_id, e.created_at);
  const jobIds = [...bookedAt.keys()];

  let bookings: AutopilotBooking[] = [];
  if (jobIds.length) {
    const [{ data: jobs }, { data: invoices }] = await Promise.all([
      s.from("chillbros_jobs").select("id,job_number,status,scheduled_window,customer:chillbros_customers(name)").in("id", jobIds),
      s.from("chillbros_invoices").select("id,job_id,status,payment_status,discount_amount,tax_amount").in("job_id", jobIds).is("converted_invoice_id", null).is("revoked_at", null),
    ]);
    const invoiceIds = (invoices ?? []).map((i) => i.id);
    const [{ data: lines }, { data: adjustments }] = invoiceIds.length
      ? await Promise.all([
          s.from("chillbros_invoice_line_items").select("invoice_id,amount").in("invoice_id", invoiceIds),
          s.from("chillbros_invoice_adjustments").select("invoice_id,adjustment_type,amount").in("invoice_id", invoiceIds),
        ])
      : [{ data: [] as { invoice_id: string; amount: number }[] }, { data: [] as { invoice_id: string; adjustment_type: string; amount: number }[] }];
    const subtotal = new Map<string, number>();
    for (const l of lines ?? []) subtotal.set(l.invoice_id, (subtotal.get(l.invoice_id) ?? 0) + Number(l.amount ?? 0));
    const credit = new Map<string, number>();
    for (const a of adjustments ?? []) if (a.adjustment_type !== "refund") credit.set(a.invoice_id, (credit.get(a.invoice_id) ?? 0) + Number(a.amount ?? 0));
    const byJob = new Map<string, { invoiced: number; paid: number }>();
    for (const inv of invoices ?? []) {
      // Quotes awaiting approval are not revenue yet; count approved/issued invoices.
      if (inv.status === "awaiting_approval" || inv.status === "draft") continue;
      const total = Math.max(0, (subtotal.get(inv.id) ?? 0) - Number(inv.discount_amount ?? 0) + Number(inv.tax_amount ?? 0) - (credit.get(inv.id) ?? 0));
      const agg = byJob.get(inv.job_id) ?? { invoiced: 0, paid: 0 };
      agg.invoiced += total;
      if (inv.payment_status === "paid") agg.paid += total;
      byJob.set(inv.job_id, agg);
    }
    bookings = (jobs ?? []).map((j) => {
      const c = Array.isArray(j.customer) ? j.customer[0] : j.customer;
      const m = byJob.get(j.id) ?? { invoiced: 0, paid: 0 };
      return { jobId: j.id, jobNumber: j.job_number ?? null, customerName: c?.name ?? "Customer", window: j.scheduled_window, status: String(j.status), bookedAt: bookedAt.get(j.id)!, invoiced: m.invoiced, paid: m.paid };
    }).sort((a, b) => b.bookedAt.localeCompare(a.bookedAt));
  }

  const invoiced = bookings.reduce((n, b) => n + b.invoiced, 0);
  const paid = bookings.reduce((n, b) => n + b.paid, 0);
  const estCost = Math.round(((sent.total - sms) * EST_COST_PER_AI_EMAIL + sms * EST_COST_PER_SMS) * 100) / 100;

  return {
    days,
    settings,
    openSlots5Days: openSlotCount(slots, centralNow().date, 5),
    sent,
    leads: { prospectsWithEmail: prospectsWithEmail.count ?? 0, foundThisPeriod: foundThisPeriod.count ?? 0, inSequence: inSequence.count ?? 0, unsubscribed: unsubscribed.count ?? 0, inboundLeads: inboundLeads.count ?? 0 },
    bookings,
    money: { bookedJobs: bookings.length, invoiced, paid, estCost, profitPaid: paid - estCost },
    activity: (recent ?? []).map((r) => ({ at: r.created_at, lane: r.lane, channel: r.channel, recipient: r.recipient, subject: r.subject, status: r.status })),
  };
}
