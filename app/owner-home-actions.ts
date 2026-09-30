"use server";

import { revalidatePath } from "next/cache";

import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import { createServiceRoleClient } from "@/lib/supabase/service-client";

async function requireManager() {
  const profile = await getCurrentStaffProfile();
  if (!profile || profile.role !== "manager") return null;
  return profile;
}

export async function clearOwnerPaymentNotificationAction(formData: FormData) {
  const profile = await requireManager();
  if (!profile) return;
  const invoiceId = String(formData.get("invoiceId") ?? "").trim();
  if (!invoiceId) return;

  const supabase = createServiceRoleClient();
  const { data: invoice } = await supabase
    .from("chillbros_invoices")
    .select("id,job_id,payment_status")
    .eq("id", invoiceId)
    .eq("payment_status", "paid")
    .maybeSingle();
  if (!invoice) return;

  await supabase.from("chillbros_workflow_events").insert({
    job_id: invoice.job_id,
    invoice_id: invoice.id,
    actor_id: profile.id,
    stage: "owner_payment_notification_cleared",
    message: "Owner cleared the paid-invoice notification from Home. Payment and invoice records were left unchanged.",
  });

  revalidatePath("/");
}

export async function clearAllOwnerPaymentNotificationsAction() {
  const profile = await requireManager();
  if (!profile) return;

  const supabase = createServiceRoleClient();
  const { data: paid } = await supabase
    .from("chillbros_invoices")
    .select("id,job_id,paid_at")
    .eq("payment_status", "paid")
    .not("paid_at", "is", null)
    .order("paid_at", { ascending: false })
    .limit(100);
  if (!paid?.length) return;

  const ids = paid.map((row) => row.id);
  const { data: clears } = await supabase
    .from("chillbros_workflow_events")
    .select("invoice_id,created_at")
    .in("invoice_id", ids)
    .eq("stage", "owner_payment_notification_cleared")
    .order("created_at", { ascending: false });

  const latestClear = new Map<string, string>();
  for (const event of clears ?? []) {
    if (event.invoice_id && !latestClear.has(event.invoice_id)) latestClear.set(event.invoice_id, event.created_at);
  }

  const rows = paid
    .filter((invoice) => {
      const clearedAt = latestClear.get(invoice.id);
      return !clearedAt || new Date(clearedAt).getTime() < new Date(invoice.paid_at).getTime();
    })
    .map((invoice) => ({
      job_id: invoice.job_id,
      invoice_id: invoice.id,
      actor_id: profile.id,
      stage: "owner_payment_notification_cleared",
      message: "Owner cleared the paid-invoice notification from Home. Payment and invoice records were left unchanged.",
    }));

  if (rows.length) await supabase.from("chillbros_workflow_events").insert(rows);
  revalidatePath("/");
}
