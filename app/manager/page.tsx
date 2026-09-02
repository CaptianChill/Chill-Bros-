import { AppShell } from "@/components/app-shell";
import { ManagerUserPanel } from "@/components/manager-user-panel";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { customerDirectory, emailLog, feeSettings, technicianAccounts } from "@/lib/mock-data";

export default function ManagerPage() {
  return (
    <AppShell
      title="Manager and owner controls for credentials, pricing, dispatch approvals, and communication review."
      description="This hub centralizes the internal-only workflows called out in the brief: technician account management, automated fee controls, customer approval triage, and a communication center that keeps the office informed."
      highlight={
        <div className="space-y-4">
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">Manager highlights</p>
          <div className="space-y-3">
            <StatusPill tone="emerald">Technician credential control</StatusPill>
            <StatusPill>Approval queue ready</StatusPill>
            <StatusPill>Inventory fee presets</StatusPill>
          </div>
          <p className="text-sm leading-7 text-zinc-300">Use this view to add or edit technicians, reset passwords, and review the approval chain that feeds parts ordering and invoicing.</p>
        </div>
      }
    >
      <div className="space-y-6">
        <SectionCard eyebrow="User control panel" title="Technician accounts" description="Add logins, reset passwords, and toggle active or inactive status directly from the manager dashboard.">
          <ManagerUserPanel accounts={technicianAccounts} />
        </SectionCard>

        <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
          <SectionCard eyebrow="Pricing admin" title="Automatic fee controls" description="Baseline fees that can auto-populate on new service quotes and invoices.">
            <div className="space-y-3">
              {feeSettings.map((fee) => (
                <div key={fee.label} className="flex items-center justify-between rounded-2xl border border-cyan-400/20 bg-black/40 px-4 py-3">
                  <div>
                    <p className="text-white">{fee.label}</p>
                    <p className="text-sm text-zinc-400">Applies automatically on new customer quotes</p>
                  </div>
                  <p className="text-xl font-semibold text-cyan-200">${fee.amount}</p>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard eyebrow="Dispatch and communication" title="Order review + email center" description="Customer approvals surface here immediately so parts ordering and office follow-up can happen without delay.">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-3 rounded-2xl border border-cyan-400/20 bg-black/40 p-4">
                <h3 className="font-medium text-white">Customer-approved jobs</h3>
                {customerDirectory.map((customer) => (
                  <div key={customer.id} className="rounded-2xl border border-cyan-400/10 bg-zinc-950/80 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-white">{customer.name}</p>
                      <StatusPill tone="emerald">Ready</StatusPill>
                    </div>
                    <p className="mt-2 text-sm text-zinc-400">{customer.address}</p>
                    <p className="mt-2 text-sm text-cyan-200">Latest activity: {customer.lastEmail}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-3 rounded-2xl border border-cyan-400/20 bg-black/40 p-4">
                <h3 className="font-medium text-white">Email logs</h3>
                {emailLog.map((entry) => (
                  <div key={entry.subject} className="rounded-2xl border border-cyan-400/10 bg-zinc-950/80 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-white">{entry.subject}</p>
                      <StatusPill>{entry.status}</StatusPill>
                    </div>
                    <p className="mt-2 text-sm text-zinc-400">{entry.recipients}</p>
                  </div>
                ))}
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </AppShell>
  );
}
