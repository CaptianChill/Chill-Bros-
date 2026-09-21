import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service-client";

export type PaymentSettings = {
  stripeEnabled: boolean;
  zelleContact: string;
  cashAppHandle: string;
  venmoHandle: string;
  chimeHandle: string;
  checkPayableTo: string;
  checkMailingAddress: string;
  manualAchInstructions: string;
  customerPaymentNote: string;
};

export const DEFAULT_PAYMENT_SETTINGS: PaymentSettings = {
  stripeEnabled: false,
  zelleContact: "",
  cashAppHandle: "",
  venmoHandle: "",
  chimeHandle: "",
  checkPayableTo: "Chill Professionals LLC",
  checkMailingAddress: "",
  manualAchInstructions: "",
  customerPaymentNote: "",
};

export async function getPaymentSettings(): Promise<PaymentSettings> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase.from("chillbros_payment_settings").select("stripe_enabled,zelle_contact,cash_app_handle,venmo_handle,chime_handle,check_payable_to,check_mailing_address,manual_ach_instructions,customer_payment_note").eq("id", "default").maybeSingle();
  if (!data) return { ...DEFAULT_PAYMENT_SETTINGS, stripeEnabled: stripeConfigured() };
  return {
    stripeEnabled: Boolean(data.stripe_enabled),
    zelleContact: data.zelle_contact ?? "",
    cashAppHandle: data.cash_app_handle ?? "",
    venmoHandle: data.venmo_handle ?? "",
    chimeHandle: data.chime_handle ?? "",
    checkPayableTo: data.check_payable_to ?? "",
    checkMailingAddress: data.check_mailing_address ?? "",
    manualAchInstructions: data.manual_ach_instructions ?? "",
    customerPaymentNote: data.customer_payment_note ?? "",
  };
}

export function stripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);
}

export async function updatePaymentSettings(input: { zelleContact: string; venmoHandle: string; chimeHandle: string; checkPayableTo: string; checkMailingAddress: string }, updatedBy: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("chillbros_payment_settings").update({
    zelle_contact: input.zelleContact.trim().slice(0, 200) || null,
    venmo_handle: input.venmoHandle.trim().slice(0, 200) || null,
    chime_handle: input.chimeHandle.trim().slice(0, 200) || null,
    check_payable_to: input.checkPayableTo.trim().slice(0, 200) || null,
    check_mailing_address: input.checkMailingAddress.trim().slice(0, 500) || null,
    updated_by: updatedBy,
    updated_at: new Date().toISOString(),
  }).eq("id", "default");
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
