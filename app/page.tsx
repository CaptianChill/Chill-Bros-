import { ArrowRight, ClipboardList, Mail, ShieldCheck } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { LogoBadge } from "@/components/logo-badge";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { dashboardMetrics, roleAccess, workflowBoard } from "@/lib/mock-data";

export default function HomePage() {
  return (
    <AppShell
      title="Run dispatch, service, approvals, billing, and customer visibility from one black-and-cyan workspace."
      description="This Chill Bros command center now carries the official logo pack and matching black, ice-white, and electric-cyan brand treatment across manager controls, technician workflows, the mobile timesheet experience, inventory + CRM dashboards, and the customer portal."
      highlight={
        <div className="flex h-full flex-col justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-[#8ffafa]">Brand spotlight</p>
            <p className="mt-2 text-sm leading-7 text-zinc-300">Primary, text, and icon logos are now sourced directly from the provided Chill Bros PNG assets in /public for consistent brand presentation on every route.</p>
          </div>
          <LogoBadge variant="full" className="mx-auto w-full max-w-[12rem]" />
        </div>
      }
    >
      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <SectionCard eyebrow="Live overview" title="Operational pulse" description="Key metrics across dispatch, approvals, inventory, and communication.">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {dashboardMetrics.map((metric) => (
                <div key={metric.label} className="rounded-2xl border border-[#00f0f0]/25 bg-black/40 p-4">
                  <p className="text-sm text-zinc-400">{metric.label}</p>
                  <p className="mt-3 text-3xl font-semibold text-white">{metric.value}</p>
                  <p className="mt-2 text-sm text-[#bafcfc]">{metric.detail}</p>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard eyebrow="Workflow queue" title="Everything tied to one approval chain" description="Manager review, technician input, and customer activity all point back to the same internal workflow hub.">
            <div className="grid gap-4 lg:grid-cols-3">
              {workflowBoard.map((column) => (
                <div key={column.title} className="rounded-2xl border border-[#00f0f0]/20 bg-black/40 p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-white">{column.title}</h3>
                    <StatusPill>{column.count}</StatusPill>
                  </div>
                  <ul className="mt-4 space-y-3 text-sm text-zinc-300">
                    {column.items.map((item) => (
                      <li key={item} className="rounded-2xl border border-[#00f0f0]/10 bg-zinc-950/70 px-3 py-3">{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard eyebrow="Access model" title="Role-based visibility" description="A single Firebase-ready role system maps exactly to the manager, technician, and client experiences requested in the brief.">
            <div className="space-y-4">
              {roleAccess.map((role) => (
                <div key={role.role} className="rounded-2xl border border-[#00f0f0]/20 bg-black/40 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-medium text-white">{role.role}</h3>
                    <ShieldCheck className="h-4 w-4 text-[#8ffafa]" />
                  </div>
                  <ul className="mt-3 space-y-2 text-sm text-zinc-300">
                    {role.access.map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-[#8ffafa]" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard eyebrow="System automation" title="Client messaging path" description="Every major state change is already framed around branded customer links and internal alerts.">
            <div className="space-y-3 text-sm text-zinc-300">
              <div className="flex items-start gap-3 rounded-2xl border border-[#00f0f0]/20 bg-black/40 p-4">
                <Mail className="mt-0.5 h-5 w-5 text-[#8ffafa]" />
                Quote sent, invoice ready, and receipt notifications all copy chillbrostx@gmail.com.
              </div>
              <div className="flex items-start gap-3 rounded-2xl border border-[#00f0f0]/20 bg-black/40 p-4">
                <ClipboardList className="mt-0.5 h-5 w-5 text-[#8ffafa]" />
                Portal approvals flow back to the manager queue so parts ordering can happen immediately.
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </AppShell>
  );
}
