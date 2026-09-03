import { AppShell } from "@/components/app-shell";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { getCustomers, getEmailLog } from "@/lib/chillbros/queries";


export const dynamic = "force-dynamic";

export default async function CrmPage() {
  const [customers, emailLog] = await Promise.all([getCustomers(), getEmailLog(15)]);

  return (
    <AppShell
      title="Customer directory, service history, and communication log visibility for the office."
      description="This CRM view gives the team a centralized place to review contact data, past service notes, and outbound email activity tied to quotes, invoices, and receipts."
      highlight={
        <div className="space-y-3">
          <p className="text-sm uppercase tracking-[0.3em] text-[#8ffafa]">CRM pulse</p>
          <StatusPill tone="emerald">{customers.length} customers on file</StatusPill>
          <StatusPill>Email logs visible</StatusPill>
        </div>
      }
    >
      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <SectionCard eyebrow="Customer directory" title="Active customer records" description="Names, addresses, phone numbers, emails, and recent service history — new customers are added when a job is created.">
          {customers.length === 0 ? (
            <p className="text-sm text-zinc-400">No customers yet.</p>
          ) : (
            <div className="space-y-4">
              {customers.map((customer) => (
                <div key={customer.id} className="rounded-2xl border border-[#2d7dff]/20 bg-black/40 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-medium text-white">{customer.name}</h3>
                      <p className="mt-1 text-sm text-zinc-400">{customer.address ?? "No address on file"}</p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-[#2d7dff]/10 bg-zinc-950/80 p-3 text-sm text-zinc-300">
                      <p>{customer.phone ?? "No phone on file"}</p>
                      <p className="mt-1 text-[#bafcfc]">{customer.email ?? "No email on file"}</p>
                    </div>
                    <div className="rounded-2xl border border-[#2d7dff]/10 bg-zinc-950/80 p-3 text-sm text-zinc-300">
                      <p className="mb-2 text-zinc-500">Past service history</p>
                      {customer.history.length === 0 ? (
                        <p className="text-zinc-500">No service history yet.</p>
                      ) : (
                        <ul className="space-y-1">
                          {customer.history.map((event) => (
                            <li key={event}>{event}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard eyebrow="Email hub" title="Outbound communications" description="Quotes, invoices, and receipts stay visible here so the office can confirm delivery and follow-up.">
          {emailLog.length === 0 ? (
            <p className="text-sm text-zinc-400">No outbound email events logged yet.</p>
          ) : (
            <div className="space-y-3">
              {emailLog.map((entry) => (
                <div key={entry.id} className="rounded-2xl border border-[#2d7dff]/20 bg-black/40 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-medium text-white">{entry.subject}</p>
                    <StatusPill tone={entry.status === "failed" ? "rose" : entry.status === "sent" ? "emerald" : "amber"}>{entry.status}</StatusPill>
                  </div>
                  <p className="mt-2 text-sm text-zinc-400">{entry.recipients}</p>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </AppShell>
  );
}
