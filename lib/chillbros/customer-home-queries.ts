import "server-only";

import { getInvoiceV2ByToken, invoiceTotals } from "@/lib/chillbros/invoice-v2";
import { dayParts, displayTime, parseWindow } from "@/lib/chillbros/schedule-window";
import { createServiceRoleClient } from "@/lib/supabase/service-client";

/**
 * Everything the customer homepage shows. Every query is filtered to the
 * customer ids linked to the signed-in account, so a customer only ever sees
 * their own records.
 */

export type HomeLocation = { id: string; name: string; address: string | null; phone: string | null };
export type HomeDocument = { id: string; number: string; token: string; kind: "Estimate" | "Invoice"; action: "pay" | "approve" | "view" | "down_payment"; amount: number; label: string; dueAt: string | null; paidAt: string | null; customerName: string };
export type HomeVisit = { id: string; jobNumber: string | null; title: string; when: string | null; statusLabel: string; tone: "blue" | "amber" | "green"; customerName: string; dateKey: string | null };
export type HomePlan = { id: string; token: string | null; title: string; detail: string; status: string; customerName: string };
export type HomeUnit = { id: string; name: string; detail: string; tag: string | null; lastService: string | null; customerName: string };
export type HomeHistory = { id: string; jobNumber: string | null; title: string; date: string; unit: string | null };

export type CustomerHome = {
  locations: HomeLocation[];
  due: HomeDocument[];
  paid: HomeDocument[];
  upcoming: HomeVisit[];
  plans: HomePlan[];
  units: HomeUnit[];
  history: HomeHistory[];
};

const CUSTOMER_STATUS: Record<string, { label: string; tone: HomeVisit["tone"] }> = {
  new: { label: "Request received", tone: "amber" },
  needs_scheduling: { label: "Request received · we'll call to schedule", tone: "amber" },
  scheduled: { label: "Scheduled", tone: "blue" },
  dispatched: { label: "Technician assigned", tone: "blue" },
  en_route: { label: "Technician on the way", tone: "blue" },
  arrived: { label: "Technician on site", tone: "blue" },
  in_progress: { label: "In progress", tone: "blue" },
  diagnosing: { label: "In progress", tone: "blue" },
  repairing: { label: "In progress", tone: "blue" },
  awaiting_approval: { label: "Waiting on your approval", tone: "amber" },
  approved: { label: "Approved · being scheduled", tone: "blue" },
  parts_required: { label: "Waiting on parts", tone: "amber" },
  return_visit_needed: { label: "Return visit needed", tone: "amber" },
  work_complete: { label: "Work complete", tone: "green" },
  ready_to_invoice: { label: "Work complete", tone: "green" },
  invoice_sent: { label: "Work complete · invoice sent", tone: "green" },
};

const ACTIVE = Object.keys(CUSTOMER_STATUS);
const DONE = ["completed", "paid", "invoice_sent", "work_complete", "ready_to_invoice"];
// Billing-only records (no visit) and internal markers the dispatch board writes.
const BILLING_ONLY = /^(Standalone|Owner-created)/i;
const INTERNAL_WINDOW = /^(Approved|Standalone|Owner-created)/i;

/** "2026-10-09 08:00-10:00 CT" -> "Thursday, October 9 · 8:00 AM–10:00 AM" */
function friendlyWindow(window: string | null) {
  if (!window || INTERNAL_WINDOW.test(window)) return null;
  const w = parseWindow(window);
  if (!w) return window;
  return `${dayParts(w.date).label} · ${displayTime(w.start)}–${displayTime(w.end)}`;
}

function firstLine(text: string | null | undefined, max = 90) {
  const line = String(text ?? "").split("\n")[0].replace(/^Customer request \(.+?\):\s*/i, "").trim();
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}

function unitLabel(u: { equipment_type: string | null; manufacturer: string | null; model: string | null } | null) {
  if (!u) return null;
  return [u.equipment_type, [u.manufacturer, u.model].filter(Boolean).join(" ")].filter(Boolean).join(" · ") || null;
}

function dateKey(window: string | null) {
  return parseWindow(window)?.date ?? null;
}

export async function getCustomerHome(customerIds: string[]): Promise<CustomerHome> {
  const empty: CustomerHome = { locations: [], due: [], paid: [], upcoming: [], plans: [], units: [], history: [] };
  if (!customerIds.length) return empty;
  const s = createServiceRoleClient();

  const [customers, jobs, invoices, equipment, agreements] = await Promise.all([
    s.from("chillbros_customers").select("id,name,address,phone").in("id", customerIds),
    s.from("chillbros_jobs").select("id,job_number,status,scope,work_performed,location,scheduled_window,created_at,updated_at,equipment_id,customer_id").in("customer_id", customerIds).is("archived_at", null).order("updated_at", { ascending: false }).limit(300),
    s.from("chillbros_invoices").select("id,invoice_number,portal_token,status,payment_status,issued_at,paid_at,due_at,created_at,customer_id,converted_invoice_id").in("customer_id", customerIds).is("revoked_at", null).neq("status", "void").order("created_at", { ascending: false }).limit(200),
    s.from("chillbros_equipment").select("id,customer_id,asset_tag,equipment_type,manufacturer,model,serial_number").in("customer_id", customerIds).order("created_at", { ascending: true }),
    s.from("chillbros_service_agreements").select("id,customer_id,agreement_number,portal_token,title,status,visits_per_month,preferred_days,preferred_time_window,start_date").in("customer_id", customerIds).in("status", ["proposed", "accepted", "active"]),
  ]);

  if ([customers, jobs, invoices, equipment, agreements].some((result) => result.error)) {
    throw new Error("Your account records could not be loaded. Please try again.");
  }

  const locations: HomeLocation[] = (customers.data ?? []).map((c) => ({ id: c.id, name: c.name, address: c.address, phone: c.phone }));
  const nameOf = new Map(locations.map((l) => [l.id, l.name]));
  const units = equipment.data ?? [];
  const unitById = new Map(units.map((u) => [u.id, u]));

  // Estimates and invoices. Exact amounts come from the same calculation the
  // pay/approve page uses, so what the customer sees here always matches.
  const due: HomeDocument[] = [];
  const paid: HomeDocument[] = [];
  const invoiceRows = (invoices.data ?? []).filter((i) => i.portal_token && i.status !== "draft" && !(i.converted_invoice_id && !i.issued_at));
  const detailed: Awaited<ReturnType<typeof getInvoiceV2ByToken>>[] = [];
  for (let offset = 0; offset < invoiceRows.length; offset += 10) {
    detailed.push(...await Promise.all(invoiceRows.slice(offset, offset + 10).map((i) => getInvoiceV2ByToken(i.portal_token))));
  }
  if (detailed.some((invoice) => !invoice)) throw new Error("Your billing records could not be loaded. Please try again.");
  invoiceRows.forEach((row, index) => {
    const inv = detailed[index];
    if (!inv) return;
    const totals = invoiceTotals(inv);
    const issued = Boolean(inv.issuedAt);
    const isPaid = inv.paymentStatus === "paid";
    const approved = inv.status === "approved";
    // A quote that was converted into an invoice is represented by that invoice.
    if (row.converted_invoice_id && !issued) return;
    const kind: HomeDocument["kind"] = issued || isPaid ? "Invoice" : "Estimate";
    const base = { id: inv.id, number: inv.invoiceNumber, token: row.portal_token, kind, dueAt: inv.dueAt, paidAt: row.paid_at, customerName: nameOf.get(row.customer_id) ?? "" };
    const firstItem = inv.lineItems[0]?.label ?? null;
    // Same order of checks as app/portal/[token]/page.tsx, so the button here
    // always matches the screen the customer lands on.
    if (isPaid) {
      paid.push({ ...base, action: "view", amount: totals.total, label: firstItem ?? "Paid" });
    } else if (inv.status === "draft") {
      // Not sent to the customer yet.
    } else if (!approved) {
      due.push({ ...base, action: "approve", amount: issued ? totals.amountDueNow : totals.total, label: firstItem ?? "Estimate" });
    } else if (issued) {
      if (totals.amountDueNow > 0) due.push({ ...base, action: "pay", amount: totals.amountDueNow, label: firstItem ?? "Service" });
    } else if (!inv.convertedInvoiceId && inv.downPaymentAmount > 0 && inv.downPaymentStatus !== "paid") {
      due.push({ ...base, action: "down_payment", amount: Math.min(inv.downPaymentAmount, totals.total), label: firstItem ?? "Down payment" });
    }
  });

  const allJobs = jobs.data ?? [];
  const upcoming: HomeVisit[] = allJobs
    .filter((j) => ACTIVE.includes(j.status) && !["work_complete", "ready_to_invoice", "invoice_sent"].includes(j.status))
    .filter((j) => !BILLING_ONLY.test(String(j.scheduled_window ?? "")))
    .map((j) => {
      const st = CUSTOMER_STATUS[j.status];
      const unit = unitLabel(unitById.get(j.equipment_id ?? "") ?? null);
      return {
        id: j.id,
        jobNumber: j.job_number,
        title: firstLine(j.scope) || (unit ? `Service · ${unit}` : "Service call"),
        when: friendlyWindow(j.scheduled_window),
        statusLabel: st.label,
        tone: st.tone,
        customerName: nameOf.get(j.customer_id) ?? "",
        dateKey: dateKey(j.scheduled_window),
      };
    })
    .sort((a, b) => (a.dateKey ?? "9999").localeCompare(b.dateKey ?? "9999"));

  const history: HomeHistory[] = allJobs
    .filter((j) => DONE.includes(j.status))
    .filter((j) => !BILLING_ONLY.test(String(j.scheduled_window ?? "")) || j.work_performed)
    .slice(0, 25)
    .map((j) => ({
      id: j.id,
      jobNumber: j.job_number,
      title: firstLine(j.work_performed) || firstLine(j.scope) || "Service visit",
      date: j.updated_at,
      unit: unitLabel(unitById.get(j.equipment_id ?? "") ?? null),
    }));

  const lastServiceByUnit = new Map<string, string>();
  for (const j of allJobs) {
    if (!j.equipment_id || !DONE.includes(j.status)) continue;
    const prev = lastServiceByUnit.get(j.equipment_id);
    if (!prev || j.updated_at > prev) lastServiceByUnit.set(j.equipment_id, j.updated_at);
  }

  const homeUnits: HomeUnit[] = units.map((u) => ({
    id: u.id,
    name: u.equipment_type || "Equipment",
    detail: [u.manufacturer, u.model].filter(Boolean).join(" "),
    tag: u.asset_tag,
    lastService: lastServiceByUnit.get(u.id) ?? null,
    customerName: nameOf.get(u.customer_id) ?? "",
  }));

  const plans: HomePlan[] = (agreements.data ?? []).map((a) => {
    const days = Array.isArray(a.preferred_days) && a.preferred_days.length ? a.preferred_days.join(", ") : null;
    const visits = a.visits_per_month ? `${a.visits_per_month} visit${a.visits_per_month === 1 ? "" : "s"} a month` : null;
    return {
      id: a.id,
      token: a.portal_token,
      title: a.title || "Service plan",
      detail: [visits, days, a.preferred_time_window].filter(Boolean).join(" · "),
      status: a.status === "proposed" ? "Waiting on your approval" : a.status === "accepted" ? "Approved · starting soon" : "Active",
      customerName: nameOf.get(a.customer_id) ?? "",
    };
  });

  return { locations, due, paid, upcoming, plans, units: homeUnits, history };
}

export async function getCustomerUnit(customerIds: string[], unitId: string) {
  if (!customerIds.length) return null;
  const s = createServiceRoleClient();
  const { data: unit } = await s.from("chillbros_equipment").select("id,customer_id,asset_tag,equipment_type,manufacturer,model,serial_number,refrigerant").eq("id", unitId).maybeSingle();
  if (!unit || !customerIds.includes(unit.customer_id)) return null;
  const { data: jobs } = await s.from("chillbros_jobs").select("id,job_number,status,scope,work_performed,updated_at,scheduled_window").eq("equipment_id", unit.id).eq("customer_id", unit.customer_id).is("archived_at", null).order("updated_at", { ascending: false }).limit(50);
  const visits = (jobs ?? []).filter((j) => j.status !== "cancelled").map((j) => ({
    id: j.id,
    jobNumber: j.job_number,
    title: firstLine(j.work_performed, 200) || firstLine(j.scope, 200) || "Service visit",
    date: j.updated_at,
    done: DONE.includes(j.status),
    statusLabel: CUSTOMER_STATUS[j.status]?.label ?? (j.status === "completed" || j.status === "paid" ? "Complete" : j.status),
  }));
  return { unit, visits };
}
