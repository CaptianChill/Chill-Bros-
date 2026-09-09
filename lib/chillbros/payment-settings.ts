import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service-client";

export type PaymentSettings = {
  stripeEnabled: boolean;
  zelleContact: string;
  cashAppHandle: string;
  venmoHandle: string;
  checkPayableTo: string;
  manualAchInstructions: string;
  customerPaymentNote: string;
};

export const DEFAULT_PAYMENT_SETTINGS: PaymentSettings = {
  stripeEnabled: false,
  zelleContact: "",
  cashAppHandle: "",
  venmoHandle: "",
  checkPayableTo: "Chill Professionals LLC",
  manualAchInstructions: "",
  customerPaymentNote: "",
};

export async function getPaymentSettings(): Promise<PaymentSettings> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase.from("chillbros_payment_settings").select("stripe_enabled,zelle_contact,cash_app_handle,venmo_handle,check_payable_to,manual_ach_instructions,customer_payment_note").eq("id", "default").maybeSingle();
  if (!data) return { ...DEFAULT_PAYMENT_SETTINGS, stripeEnabled: stripeConfigured() };
  return {
    stripeEnabled: Boolean(data.stripe_enabled),
    zelleContact: data.zelle_contact ?? "",
    cashAppHandle: data.cash_app_handle ?? "",
    venmoHandle: data.venmo_handle ?? "",
    checkPayableTo: data.check_payable_to ?? "",
    manualAchInstructions: data.manual_ach_instructions ?? "",
    customerPaymentNote: data.customer_payment_note ?? "",
  };
}

export function stripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);
}
