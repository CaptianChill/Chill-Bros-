"use server";

import { revalidatePath } from "next/cache";

import { getInvoiceV2ById } from "@/lib/chillbros/invoice-v2";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import { createServiceRoleClient } from "@/lib/supabase/service-client";

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };
const round2 = (value: number) => Math.round(value * 100) / 100;

async function requireOwner() {
  const profile = await getCurrentStaffProfile();
  if (!profile || profile.role !== "manager") return null;
  return profile;
}

function refresh(jobId?: string | null) {
  revalidatePath("/payroll");
  if (jobId) revalidatePath(`/jobs/${jobId}`);
}

export async function saveStaffPaySettingAction(profileId: string, payType: "hourly" | "piece", ratePercent: number): Promise<Result> {
  const owner = await requireOwner();
  if (!owner) return { ok: false, error: "Owner access required." };
  const rate = Number(ratePercent) / 100;
  if (!["hourly", "piece"].includes(payType)) return { ok: false, error: "Choose hourly or piece pay." };
  if (!Number.isFinite(rate) || rate < 0 || rate > 1) return { ok: false, error: "Rate must be between 0% and 100%." };
  const { error } = await createServiceRoleClient().from("chillbros_tech_pay_settings").upsert({ profile_id: profileId, pay_type: payType, piece_rate: round2(rate * 100) / 100, updated_by: owner.id, updated_at: new Date().toISOString() });
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true, data: undefined };
}

/**
 * Save (approve) a technician's piece pay for one finished job. Revenue and
 * line prices come from the invoice on the server — only the owner's costs,
 * rate and final amount come from the form.
 */
export async function savePiecePayAction(input: {
  invoiceId: string; technicianId: string; lineCosts: { key: string; label: string; cost: number }[];
  ratePercent: number; payAmount: number; isCallback: boolean; notes: string;
}): Promise<Result<{ payAmount: number }>> {
  const owner = await requireOwner();
  if (!owner) return { ok: false, error: "Owner access required." };
  const invoice = await getInvoiceV2ById(input.invoiceId);
  if (!invoice || invoice.status !== "approved" || !invoice.issuedAt) return { ok: false, error: "Only finished, issued invoices can be paid out." };

  const supabase = createServiceRoleClient();
  const { data: tech } = await supabase.from("chillbros_profiles").select("id").eq("id", input.technicianId).maybeSingle();
  if (!tech) return { ok: false, error: "Choose the technician who did the work." };
  const { data: existing } = await supabase.from("chillbros_piece_pay").select("id,status").eq("invoice_id", input.invoiceId).eq("technician_id", input.technicianId).maybeSingle();
  if (existing?.status === "paid") return { ok: false, error: "This pay is already marked paid and locked." };

  const costs = Array.isArray(input.lineCosts) ? input.lineCosts.slice(0, 60) : [];
  for (const row of costs) {
    const cost = Number(row.cost);
    if (!Number.isFinite(cost) || cost < 0 || cost > 100000) return { ok: false, error: `Check the cost for "${row.label}".` };
  }
  const rate = Number(input.ratePercent) / 100;
  if (!Number.isFinite(rate) || rate < 0 || rate > 1) return { ok: false, error: "Rate must be between 0% and 100%." };
  const notes = String(input.notes ?? "").trim();
  if (notes.length > 1000) return { ok: false, error: "Notes must be 1,000 characters or fewer." };

  const revenue = round2(Math.max(0, invoice.lineItems.reduce((sum, item) => sum + item.amount, 0) - invoice.discountAmount - invoice.creditAmount));
  const costTotal = round2(costs.reduce((sum, row) => sum + Number(row.cost), 0));
  const kept = round2(revenue - costTotal);
  const calculated = input.isCallback ? 0 : round2(Math.max(0, kept) * rate);
  const payAmount = input.isCallback ? 0 : round2(Number(input.payAmount));
  if (!Number.isFinite(payAmount) || payAmount < 0 || payAmount > 50000) return { ok: false, error: "Check the pay amount." };

  const row = {
    invoice_id: invoice.id, job_id: invoice.jobId, technician_id: input.technicianId, revenue, cost_total: costTotal, kept, rate: round2(rate * 10000) / 10000,
    calculated_pay: calculated, pay_amount: payAmount, line_costs: costs.map((c) => ({ key: String(c.key).slice(0, 120), label: String(c.label).slice(0, 200), cost: round2(Number(c.cost)) })),
    is_callback: Boolean(input.isCallback), notes: notes || null, status: "approved", approved_by: owner.id, approved_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  };
  const { error } = existing
    ? await supabase.from("chillbros_piece_pay").update(row).eq("id", existing.id).eq("status", "approved")
    : await supabase.from("chillbros_piece_pay").insert(row);
  if (error) return { ok: false, error: error.message };
  refresh(invoice.jobId);
  return { ok: true, data: { payAmount } };
}

export async function markPiecePayPaidAction(ids: string[]): Promise<Result<{ count: number }>> {
  const owner = await requireOwner();
  if (!owner) return { ok: false, error: "Owner access required." };
  const clean = (Array.isArray(ids) ? ids : []).filter((id) => /^[0-9a-f-]{36}$/i.test(id)).slice(0, 200);
  if (!clean.length) return { ok: false, error: "Nothing selected." };
  const now = new Date().toISOString();
  const { data, error } = await createServiceRoleClient().from("chillbros_piece_pay").update({ status: "paid", paid_at: now, paid_by: owner.id, updated_at: now }).in("id", clean).eq("status", "approved").select("id");
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true, data: { count: data?.length ?? 0 } };
}

export async function removePiecePayAction(id: string): Promise<Result> {
  const owner = await requireOwner();
  if (!owner) return { ok: false, error: "Owner access required." };
  const { data, error } = await createServiceRoleClient().from("chillbros_piece_pay").delete().eq("id", id).eq("status", "approved").select("id,job_id").maybeSingle();
  if (error || !data) return { ok: false, error: error?.message ?? "Only approved, unpaid pay can be removed." };
  refresh(data.job_id);
  return { ok: true, data: undefined };
}
