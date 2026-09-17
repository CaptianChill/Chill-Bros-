"use server";

import { revalidatePath } from "next/cache";

import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import { createServiceRoleClient } from "@/lib/supabase/service-client";

export type OwnerEstimateRevisionLine = {
  label: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  taxable?: boolean;
};

type Result = { ok: true } | { ok: false; error: string };

function validateLines(lines: OwnerEstimateRevisionLine[]) {
  if (!Array.isArray(lines) || lines.length < 1 || lines.length > 20) return { ok: false as const, error: "Add between 1 and 20 line items." };
  const clean: Required<OwnerEstimateRevisionLine>[] = [];
  for (const row of lines) {
    const label = String(row.label ?? "").trim();
    const description = String(row.description ?? "").trim();
    const quantity = Number(row.quantity);
    const unitPrice = Number(row.unitPrice);
    const taxable = Boolean(row.taxable);
    if (!label || label.length > 200 || description.length > 1000 || !Number.isFinite(quantity) || quantity <= 0 || quantity > 1000 || !Number.isFinite(unitPrice) || unitPrice < 0 || unitPrice > 100000) {
      return { ok: false as const, error: "Check line item name, description, quantity, and unit price." };
    }
    clean.push({ label, description, quantity, unitPrice, taxable });
  }
  return { ok: true as const, lines: clean };
}

function refresh(token?: string | null) {
  for (const path of ["/technician", "/dispatch", "/manager", "/office", "/invoices", "/reports", "/"]) revalidatePath(path);
  if (token) {
    revalidatePath(`/portal/${token}`);
    revalidatePath(`/portal/${token}/document`);
  }
}

export async function replaceEstimateLinesForManagerAction(invoiceId: string, lines: OwnerEstimateRevisionLine[], notes: string): Promise<Result> {
  const profile = await getCurrentStaffProfile();
  if (!profile || profile.role !== "manager") return { ok: false, error: "Manager access required." };
  if (!invoiceId) return { ok: false, error: "Estimate is required." };

  const checked = validateLines(lines);
  if (!checked.ok) return checked;
  const cleanNotes = String(notes ?? "").trim();
  if (cleanNotes.length > 2000) return { ok: false, error: "Customer notes must be 2,000 characters or fewer." };

  const supabase = createServiceRoleClient();
  const { data: invoice } = await supabase
    .from("chillbros_invoices")
    .select("id,job_id,portal_token,status,payment_status,revoked_at")
    .eq("id", invoiceId)
    .maybeSingle();
  if (!invoice || invoice.revoked_at || invoice.status === "void") return { ok: false, error: "Estimate is not active." };
  if (invoice.payment_status === "paid") return { ok: false, error: "Paid invoices are locked. Use a credit/refund." };
  if (invoice.status === "approved") return { ok: false, error: "Reopen the unpaid invoice before editing its prices. Paid invoices require credits/refunds." };
  if (!["draft", "awaiting_approval"].includes(invoice.status)) return { ok: false, error: "This estimate is not editable." };

  const { error } = await supabase.rpc("chillbros_manager_replace_estimate_lines", {
    p_invoice_id: invoiceId,
    p_notes: cleanNotes || null,
    p_line_items: checked.lines.map((line) => ({
      label: line.label,
      description: line.description || null,
      quantity: line.quantity,
      unit_price: line.unitPrice,
      taxable: line.taxable,
    })),
  });
  if (error) return { ok: false, error: error.message };

  await supabase.from("chillbros_workflow_events").insert({
    job_id: invoice.job_id,
    invoice_id: invoiceId,
    actor_id: profile.id,
    stage: "owner_quote_revised",
    message: "Manager/owner revised quote line items and pricing before customer approval.",
  });

  refresh(invoice.portal_token);
  return { ok: true };
}
