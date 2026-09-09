"use server";

import { revalidatePath } from "next/cache";

import { createServiceRoleClient } from "@/lib/supabase/service-client";
import type { PaymentMethod } from "./types";

type Result = { ok: true } | { ok: false; error: string };

const CUSTOMER_PAYMENT_METHODS = new Set<PaymentMethod>(["cash", "check", "ach", "cash_app", "venmo", "zelle"]);

export async function setCustomerPaymentMethodAction(token: string, method: PaymentMethod): Promise<Result> {
  if (!CUSTOMER_PAYMENT_METHODS.has(method)) return { ok: false, error: "Choose an available payment method." };
  const supabase = createServiceRoleClient();
  const { data: invoice } = await supabase
    .from("chillbros_invoices")
    .select("id,job_id,status,payment_status,issued_at,revoked_at")
    .eq("portal_token", token)
    .is("revoked_at", null)
    .neq("status", "void")
    .maybeSingle();

  if (!invoice) return { ok: false, error: "This secure payment link is no longer active." };
  if (invoice.status !== "approved") return { ok: false, error: "Please sign and approve the estimate before choosing payment." };
  if (!invoice.issued_at) return { ok: false, error: "Payment is not due until Chill Bros completes the work and issues the final invoice." };

  const { error } = await supabase
    .from("chillbros_invoices")
    .update({
      payment_method: method,
      payment_status: invoice.payment_status === "paid" ? "paid" : "pending_manual_review",
      updated_at: new Date().toISOString(),
    })
    .eq("id", invoice.id)
    .not("issued_at", "is", null);
  if (error) return { ok: false, error: error.message };

  await supabase.from("chillbros_workflow_events").insert({
    job_id: invoice.job_id,
    invoice_id: invoice.id,
    stage: "payment_method_selected",
    message: `Customer selected ${method.replace(/_/g, " ")} for payment.`,
  });

  for (const path of ["/invoices", "/payments", "/reports", `/portal/${token}`, `/portal/${token}/document`]) revalidatePath(path);
  return { ok: true };
}
