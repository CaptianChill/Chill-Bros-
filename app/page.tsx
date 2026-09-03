import { ArrowRight, ClipboardList, Mail, ShieldCheck } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { LogoBadge } from "@/components/logo-badge";
import { SectionCard } from "@/components/section-card";
import { getCustomers, getDashboardMetrics, getEmailLog } from "@/lib/chillbros/queries";


export const dynamic = "force-dynamic";

const roleAccess = [
  {
    role: "Manager / Owner",
    access: ["Inventory & pricing", "Approval workflows", "Technician credential control", "Email and order review"],
  },
  {
    role: "Technician",
    access: ["Assigned jobs only", "Timesheets", "Service sheet + media uploads", "On-site customer sign-off"],
  },
  {
    role: "Client / Customer",
    access: ["No login required", "Secure per-invoice portal link", "Digital approval", "Payment selection"],
  },
];

export default async function HomePage() {
  const [metrics, customers, emailLog] = await Promise.all([getDashboardMetrics(), getCustomers(), getEmailLog(5)]);

  const dashboardMetrics = [
    { label: "Open dispatch jobs", value: String(metrics.openJobs), detail: "Scheduled or in progress" },
    { label: "Customer approvals today", value: String(metrics.approvalsToday), detail: "Signed off through the client portal" },
    { label: "Inventory alerts", value: String(metrics.lowStockParts), detail: "Parts under 5 units in stock" },
    { label: "Outbound email events today", value: String(metrics.emailEventsToday), detail: "Every message copies chillbrostx@gmail.com" },
  ];

  return (
    <AppShell
      title="Run dispatch, service, approvals, billing, and customer visibility from one blue neon sign workspace."
      description="This Chill Bros command center carries the official neon logo and matching black, ice-white, and electric-blue brand treatment across manager controls, technician workflows, the mobile timesheet experience, inventory + CRM dashboards, and the customer portal."
      highlight={
        <div className="flex h-full flex-col justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-[#8ffafa]">Brand system</p>
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
                <div key={metric.label} className="rounded-2xl border border-[#2d7dff]/25 bg-black/40 p-4">
                  <p className="text-sm text-zinc-400">{metric.label}</p>
                  <p className="mt-3 text-3xl font-semibold text-white">{metric.value}</p>
                  <p className="mt-2 text-sm text-[#bafcfc]">{metric.detail}</p>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard eyebrow="Customer directory" title="Recently active customers" description="The latest customers in the CRM, pulled straight from the database.">
            {customers.length === 0 ? (
              <p className="text-sm text-zinc-400">No customers yet. Add the first one from the CRM tab.</p>
            ) : (
              <div className="grid gap-4 lg:grid-cols-3">
                {customers.slice(0, 6).map((customer) => (
                  <div key={customer.id} className="rounded-2xl border border-[#2d7dff]/20 bg-black/40 p-4">
                    <h3 className="font-medium text-white">{customer.name}</h3>
                    <p className="mt-2 text-sm text-zinc-300">{customer.address ?? "No address on file"}</p>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard eyebrow="Access model" title="Role-based visibility" description="A single Supabase-backed role system maps exactly to the manager, technician, and client experiences.">
            <div className="space-y-4">
              {roleAccess.map((role) => (
                <div key={role.role} className="rounded-2xl border border-[#2d7dff]/20 bg-black/40 p-4">
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

          <SectionCard eyebrow="System automation" title="Recent email activity" description="Every major state change is framed around branded customer links and internal alerts.">
            <div className="space-y-3 text-sm text-zinc-300">
              {emailLog.length === 0 ? (
                <div className="flex items-start gap-3 rounded-2xl border border-[#2d7dff]/20 bg-black/40 p-4">
                  <Mail className="mt-0.5 h-5 w-5 text-[#8ffafa]" />
                  No outbound email events logged yet.
                </div>
              ) : (
                emailLog.map((entry) => (
                  <div key={entry.id} className="flex items-start gap-3 rounded-2xl border border-[#2d7dff]/20 bg-black/40 p-4">
                    <ClipboardList className="mt-0.5 h-5 w-5 text-[#8ffafa]" />
                    <div>
                      <p className="text-white">{entry.subject}</p>
                      <p className="mt-1 text-xs text-zinc-500">{entry.recipients}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </SectionCard>
        </div>
      </div>
    </AppShell>
  );
}
