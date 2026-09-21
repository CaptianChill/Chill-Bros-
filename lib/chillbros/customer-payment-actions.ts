"use server";

import { revalidatePath } from "next/cache";

import { createServiceRoleClient } from "@/lib/supabase/service-client";
import { getPaymentSettings } from "./payment-settings";
import type { PaymentMethod } from "./types";

type Result = { ok: true } | { ok: false; error: string };

const CUSTOMER_PAYMENT_METHODS = new Set<PaymentMethod>(["cash", "check", "zelle", "venmo", "chime"]);
const CONFIGURABLE_METHODS = new Set<PaymentMethod>(["zelle", "venmo", "chime"]);

export async function setCustomerPaymentMethodAction(token: string, method: PaymentMethod): Promise<Result> {
  if (!CUSTOMER_PAYMENT_METHODS.has(method)) return { ok: false, error: "Choose an available payment method." };
  if (CONFIGURABLE_METHODS.has(method)) {
    const settings = await getPaymentSettings();
    const configured = method === "zelle" ? settings.zelleContact : method === "venmo" ? settings.venmoHandle : settings.chimeHandle;
    if (!configured.trim()) return { ok: false, error: `${method === "zelle" ? "Zelle" : method === "venmo" ? "Venmo" : "Chime"} is not set up yet. Choose another payment option.` };
  }
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
  if (!invoice.issued_at) return { ok: false, error: "Payment is not due until Chill Pros completes the work and issues the final invoice." };

  if (invoice.payment_status === "paid") return { ok: false, error: "Payment is already recorded." };

  const { data: updated, error } = await supabase
    .from("chillbros_invoices")
    .update({
      payment_method: method,
      payment_status: "pending_manual_review",
      updated_at: new Date().toISOString(),
    })
    .eq("id", invoice.id)
    .not("issued_at", "is", null)
    .eq("status", "approved")
    .is("revoked_at", null)
    .neq("payment_status", "paid")
    .select("id")
    .maybeSingle();
  if (error || !updated) return { ok: false, error: error?.message ?? "The invoice changed. Refresh before choosing payment." };

  await supabase.from("chillbros_workflow_events").insert({
    job_id: invoice.job_id,
    invoice_id: invoice.id,
    stage: "payment_method_selected",
    message: `Customer selected ${method.replace(/_/g, " ")} for payment.`,
  });

  for (const path of ["/invoices", "/payments", "/reports", `/portal/${token}`, `/portal/${token}/document`]) revalidatePath(path);
  return { ok: true };
}

export async function setCustomerDownPaymentMethodAction(token: string, method: PaymentMethod): Promise<Result> {
  if (!CUSTOMER_PAYMENT_METHODS.has(method)) return { ok: false, error: "Choose an available payment method." };
  if (CONFIGURABLE_METHODS.has(method)) {
    const settings = await getPaymentSettings();
    const configured = method === "zelle" ? settings.zelleContact : method === "venmo" ? settings.venmoHandle : settings.chimeHandle;
    if (!configured.trim()) return { ok: false, error: `${method === "zelle" ? "Zelle" : method === "venmo" ? "Venmo" : "Chime"} is not set up yet. Choose another payment option.` };
  }
  const supabase = createServiceRoleClient();
  const { data: invoice } = await supabase
    .from("chillbros_invoices")
    .select("id,job_id,status,down_payment_amount,down_payment_status,revoked_at")
    .eq("portal_token", token)
    .is("revoked_at", null)
    .neq("status", "void")
    .maybeSingle();

  if (!invoice) return { ok: false, error: "This secure payment link is no longer active." };
  if (invoice.status !== "approved") return { ok: false, error: "Please sign and approve the estimate before choosing a down payment method." };
  if (!(Number(invoice.down_payment_amount) > 0)) return { ok: false, error: "No down payment is required on this estimate." };
  if (invoice.down_payment_status === "paid") return { ok: false, error: "The down payment is already recorded." };

  const { data: updated, error } = await supabase
    .from("chillbros_invoices")
    .update({
      down_payment_method: method,
      down_payment_status: "pending_manual_review",
      updated_at: new Date().toISOString(),
    })
    .eq("id", invoice.id)
    .eq("status", "approved")
    .is("revoked_at", null)
    .neq("down_payment_status", "paid")
    .select("id")
    .maybeSingle();
  if (error || !updated) return { ok: false, error: error?.message ?? "The estimate changed. Refresh before choosing a down payment method." };

  await supabase.from("chillbros_workflow_events").insert({
    job_id: invoice.job_id,
    invoice_id: invoice.id,
    stage: "down_payment_method_selected",
    message: `Customer selected ${method.replace(/_/g, " ")} for the down payment.`,
  });

  for (const path of ["/invoices", "/payments", "/reports", `/portal/${token}`, `/portal/${token}/document`]) revalidatePath(path);
  return { ok: true };
}
