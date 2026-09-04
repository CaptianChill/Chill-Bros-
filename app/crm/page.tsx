import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { CustomerEditor } from "@/components/customer-editor";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { getCustomers, getEmailLog } from "@/lib/chillbros/queries";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";

export const dynamic = "force-dynamic";

export default async function CrmPage() {
  const profile = await getCurrentStaffProfile();
  if (!profile || !["manager", "office"].includes(profile.role)) redirect("/");
  const [customers, emailLog] = await Promise.all([getCustomers(), getEmailLog(15)]);

  return (
    <AppShell
      title="Edit customer records, review service history, and track communication activity."
      description="Customer contact data is editable by authorized office staff. Service history is retained automatically as jobs move through dispatch and field completion."
      highlight={<div className="space-y-3"><p className="text-sm uppercase tracking-[0.3em] text-[#8ffafa]">CRM pulse</p><StatusPill tone="emerald">{customers.length} customers</StatusPill><StatusPill>{emailLog.length} recent communication events</StatusPill></div>}
    >
      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <SectionCard eyebrow="Customer directory" title="Editable customer records" description="Update names, addresses, phones, and emails while preserving service history.">
          {customers.length === 0 ? <p className="text-sm text-zinc-400">No customers yet. Create the first customer from Dispatch.</p> : <div className="space-y-4">{customers.map((customer) => <CustomerEditor key={customer.id} customer={customer} />)}</div>}
        </SectionCard>

        <SectionCard eyebrow="Communication log" title="Customer communication events" description="Approval and payment workflow events remain visible here. Real outbound email can be enabled separately with a mail provider credential.">
          {emailLog.length === 0 ? <p className="text-sm text-zinc-400">No communication events logged yet.</p> : <div className="space-y-3">{emailLog.map((entry) => <div key={entry.id} className="rounded-2xl border border-[#2d7dff]/20 bg-black/40 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><p className="font-medium text-white">{entry.subject}</p><StatusPill tone={entry.status === "failed" ? "rose" : entry.status === "sent" ? "emerald" : "amber"}>{entry.status}</StatusPill></div><p className="mt-2 text-sm text-zinc-400">{entry.recipients}</p></div>)}</div>}
        </SectionCard>
      </div>
    </AppShell>
  );
}
