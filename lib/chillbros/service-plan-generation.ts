import "server-only";

import { simpleDocumentNumber } from "@/lib/chillbros/document-number";
import { createServiceRoleClient } from "@/lib/supabase/service-client";

// Turns an ACTIVE service plan into real work, one calendar month at a time:
//   - one unassigned service call per included visit (shows in Open Work / Dispatch)
//   - one monthly invoice, created unsent ("awaiting approval") so office reviews
//     it and uses the existing Finalize & email. Nothing goes to a customer automatically.
// A ledger line in the customer's service history ("Service plan SA-… · 2026-10
// generated") makes each month run exactly once, from activation or the daily cron.

type PlanRow = {
  id: string; customer_id: string; agreement_number: string; title: string; status: string;
  visits_per_month: number | string; hours_per_visit: number | string;
  preferred_days: string[] | null; preferred_time_window: string | null;
  start_date: string | null; end_date: string | null; services_included: string | null; customer_preferences: string | null;
  setup_fee: number | string; monthly_total: number | string;
  customer: { address: string | null } | { address: string | null }[] | null;
};

export type PlanMonthResult = { ok: true; created: boolean; reason?: string; visits?: number; invoiceNumber?: string } | { ok: false; error: string };

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// Calendar month in the business's time zone (San Antonio), as "YYYY-MM".
export function businessMonth(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit" }).formatToParts(date);
  return `${parts.find((p) => p.type === "year")!.value}-${parts.find((p) => p.type === "month")!.value}`;
}

export function monthLabel(month: string) {
  const [y, m] = month.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

export function ledgerNote(agreementNumber: string, month: string) {
  return `Service plan ${agreementNumber} · ${month} generated`;
}

// A plan covers a month when the month overlaps start..end (blank = open).
export function planCoversMonth(plan: { start_date: string | null; end_date: string | null }, month: string) {
  const first = `${month}-01`;
  const [y, m] = month.split("-").map(Number);
  const last = `${month}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`;
  if (plan.start_date && plan.start_date > last) return false;
  if (plan.end_date && plan.end_date < first) return false;
  return true;
}

const SELECT = "id,customer_id,agreement_number,title,status,visits_per_month,hours_per_visit,preferred_days,preferred_time_window,start_date,end_date,services_included,customer_preferences,setup_fee,monthly_total,customer:chillbros_customers(address)";

export async function generatePlanMonth(agreementId: string, month = businessMonth(), actorId: string | null = null): Promise<PlanMonthResult> {
  const supabase = createServiceRoleClient();
  const { data: plan, error } = await supabase.from("chillbros_service_agreements").select(SELECT).eq("id", agreementId).maybeSingle<PlanRow>();
  if (error || !plan) return { ok: false, error: error?.message ?? "Service plan not found." };
  if (plan.status !== "active") return { ok: true, created: false, reason: "Plan is not active." };
  if (!planCoversMonth(plan, month)) return { ok: true, created: false, reason: `Plan doesn't cover ${monthLabel(month)}.` };

  const note = ledgerNote(plan.agreement_number, month);
  const { data: already } = await supabase.from("chillbros_customer_service_history").select("id").eq("customer_id", plan.customer_id).eq("note", note).limit(1);
  if (already?.length) return { ok: true, created: false, reason: `${monthLabel(month)} visits and invoice already exist.` };

  // Claim the month first so a second run (cron + activation together) skips it.
  const { data: claim, error: claimError } = await supabase.from("chillbros_customer_service_history").insert({ customer_id: plan.customer_id, note }).select("id").single();
  if (claimError || !claim) return { ok: false, error: claimError?.message ?? "Could not start this month's plan work." };
  const release = async () => { await supabase.from("chillbros_customer_service_history").delete().eq("id", claim.id); };

  const { data: earlier } = await supabase.from("chillbros_customer_service_history").select("id").eq("customer_id", plan.customer_id).like("note", `Service plan ${plan.agreement_number} · %generated`).neq("id", claim.id).limit(1);
  const firstMonth = !earlier?.length;

  const customer = Array.isArray(plan.customer) ? plan.customer[0] : plan.customer;
  const label = monthLabel(month);
  const visits = Math.max(1, Math.min(31, Math.floor(Number(plan.visits_per_month) || 1)));
  const hours = Number(plan.hours_per_visit) || 0;
  const prefs = [
    plan.preferred_days?.length ? `Preferred days: ${plan.preferred_days.join(", ")}` : null,
    plan.preferred_time_window ? `Preferred time: ${plan.preferred_time_window}` : null,
    hours ? `Planned time: ${hours} hr` : null,
    plan.customer_preferences ? `Customer notes: ${plan.customer_preferences}` : null,
  ].filter(Boolean).join("\n");

  // 1) Visits: unassigned calls for office to schedule.
  const jobIds: string[] = [];
  for (let i = 1; i <= visits; i += 1) {
    const scope = [`Service plan ${plan.agreement_number} · ${label} · visit ${i} of ${visits}`, plan.services_included?.trim() || plan.title, prefs].filter(Boolean).join("\n\n").slice(0, 4000);
    const { data: job, error: jobError } = await supabase.from("chillbros_jobs").insert({ customer_id: plan.customer_id, assigned_tech_id: null, status: "scheduled", location: customer?.address ?? null, scope, scheduled_window: null }).select("id").single();
    if (jobError || !job) {
      if (jobIds.length) await supabase.from("chillbros_jobs").update({ status: "cancelled", updated_at: new Date().toISOString() }).in("id", jobIds);
      await release();
      return { ok: false, error: jobError?.message ?? "Could not create plan visits." };
    }
    jobIds.push(job.id);
  }

  // 2) Monthly invoice, unsent, on its own billing record (same pattern as a standalone invoice).
  const total = Math.round((Number(plan.monthly_total) || 0) * 100) / 100;
  const setup = firstMonth ? Math.round((Number(plan.setup_fee) || 0) * 100) / 100 : 0;
  const lines = [
    { label: `${plan.title} — ${label}`, description: `Monthly service plan ${plan.agreement_number}: ${visits} visit${visits === 1 ? "" : "s"}${hours ? ` × ${hours} hr` : ""}.`, quantity: 1, unit_price: total, taxable: false },
    ...(setup > 0 ? [{ label: "One-time setup / onboarding", description: `Service plan ${plan.agreement_number}`, quantity: 1, unit_price: setup, taxable: false }] : []),
  ].filter((line) => line.unit_price > 0);

  let invoiceNumber: string | undefined;
  if (lines.length) {
    const { data: billingJob, error: billingError } = await supabase.from("chillbros_jobs").insert({ customer_id: plan.customer_id, assigned_tech_id: actorId, status: "scheduled", location: customer?.address ?? null, scope: `Service plan ${plan.agreement_number} billing · ${label}`, scheduled_window: `Service plan billing · ${label}` }).select("id").single();
    if (billingError || !billingJob) return { ok: false, error: `Visits created, but the invoice record failed: ${billingError?.message ?? "unknown error"}.` };
    const number = simpleDocumentNumber("invoice");
    const { data: created, error: createError } = await supabase.rpc("chillbros_create_estimate_v2", { p_job_id: billingJob.id, p_invoice_number: number, p_notes: `Monthly service plan ${plan.agreement_number} · ${label}`, p_line_items: lines, p_adjustments: { discount_type: null, discount_value: 0, down_payment_type: null, down_payment_value: 0, tax_rate: 0 } }).single();
    if (createError || !created) {
      await supabase.from("chillbros_jobs").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", billingJob.id);
      return { ok: false, error: `Visits created, but the invoice failed: ${createError?.message ?? "unknown error"}.` };
    }
    const invoice = created as { estimate_id: string; estimate_number: string };
    const now = new Date().toISOString();
    const subtotal = lines.reduce((sum, line) => sum + line.unit_price * line.quantity, 0);
    await supabase.from("chillbros_invoices").update({ status: "awaiting_approval", issued_at: now, due_at: now, payment_terms: "due_on_receipt", payment_status: "unpaid", taxable_subtotal: 0, tax_amount: 0, updated_at: now }).eq("id", invoice.estimate_id);
    await supabase.from("chillbros_jobs").update({ status: "completed", updated_at: now }).eq("id", billingJob.id);
    invoiceNumber = invoice.estimate_number ?? number;
    await supabase.from("chillbros_customer_service_history").insert({ customer_id: plan.customer_id, note: `Service plan ${plan.agreement_number}: ${visits} visit${visits === 1 ? "" : "s"} added to Open Work and invoice ${invoiceNumber} ($${subtotal.toFixed(2)}) ready to review for ${label}.` });
  }

  return { ok: true, created: true, visits, invoiceNumber };
}

// Daily cron: catch every active plan up on the current month.
export async function generateAllActivePlans(month = businessMonth()) {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.from("chillbros_service_agreements").select("id").eq("status", "active").limit(500);
  if (error) return { ok: false as const, error: error.message };
  const results = [];
  for (const row of data ?? []) results.push({ id: row.id, ...(await generatePlanMonth(row.id, month)) });
  return { ok: true as const, month, created: results.filter((r) => r.ok && r.created).length, results };
}
