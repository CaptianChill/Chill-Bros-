import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { VoiceBillingBuilder } from "@/components/voice-billing-builder";
import { getCustomers } from "@/lib/chillbros/queries";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import { createDirectInvoiceAction } from "../new/actions";

export const dynamic = "force-dynamic";
type Props = { searchParams: Promise<{ type?: string }> };

export default async function VoiceBillingPage({ searchParams }: Props) {
  const profile = await getCurrentStaffProfile();
  if (!profile) redirect("/sign-in");
  if (!["manager", "office"].includes(profile.role)) redirect("/invoices");
  const params = await searchParams;
  const customers = await getCustomers();
  return <AppShell title="Talk It In" description="Say the quote or invoice out loud. Review it, then create and send in one tap.">
    <VoiceBillingBuilder initialType={params.type === "invoice" ? "invoice" : "quote"} customers={customers.map((c) => ({ id: c.id, name: c.name, phone: c.phone, email: c.email, address: c.address }))} action={createDirectInvoiceAction} />
  </AppShell>;
}
