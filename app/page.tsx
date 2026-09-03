import { redirect } from "next/navigation";
import { ClipboardList, Mail } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { LogoBadge } from "@/components/logo-badge";
import { SectionCard } from "@/components/section-card";
import { getCustomers, getDashboardMetrics, getEmailLog } from "@/lib/chillbros/queries";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const profile = await getCurrentStaffProfile();
  if (!profile) redirect("/sign-in");
  if (profile.role === "technician") redirect("/technician");

  const [metrics, customers, emailLog] = await Promise.all([
    getDashboardMetrics(),
    getCustomers(),
    getEmailLog(5),
  ]);

  const dashboardMetrics = [
    { label: "Open dispatch jobs", value: String(metrics.openJobs), detail: "Scheduled or in progress" },
    { label: "Customer approvals today", value: String(metrics.approvalsToday), detail: "Signed through the customer portal" },
    { label: "Inventory alerts", value: String(metrics.lowStockParts), detail: "Parts under 5 units in stock" },
    { label: "Communication events today", value: String(metrics.emailEventsToday), detail: "Approval/payment workflow records" },
  ];

  return (
    <AppShell
      title="Run dispatch, service, approvals, billing, inventory, and customer visibility from one workspace."
      description="The owner dashboard is restricted to manager accounts and reads live operational data from the Chill Bros Supabase tables."
      highlight={
        <div className="flex h-full flex-col justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-[#8ffafa]">Owner command center</p>
            <p className="mt-2 text-sm leading-7 text-zinc-300">
              Dispatch, pricing, customers, staff, estimates, payments, inventory, and timesheets stay behind manager authorization.
            </p>
          </div>
          <LogoBadge variant="full" className="mx-auto w-full max-w-[12rem]" />
        </div>
      }
    >
      <div className="grid gap-4 sm:gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-4 sm:space-y-6">
          <SectionCard eyebrow="Live overview" title="Operational pulse" description="Real counts from the production database.">
            <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
              {dashboardMetrics.map((metric) => (
                <div key={metric.label} className="rounded-2xl border border-[#2d7dff]/25 bg-black/40 p-3.5 sm:p-4">
                  <p className="text-[11px] leading-4 text-zinc-400 sm:text-sm sm:leading-5">{metric.label}</p>
                  <p className="mt-2 text-2xl font-semibold leading-none text-white sm:mt-3 sm:text-3xl">{metric.value}</p>
                  <p className="mt-1.5 text-[11px] leading-4 text-[#bafcfc] sm:mt-2 sm:text-sm sm:leading-5">{metric.detail}</p>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard eyebrow="Customer directory" title="Recently active customers" description="The latest customer records in CRM.">
            {customers.length === 0 ? (
              <p className="text-center text-sm text-zinc-400 sm:text-left">No customers yet. Create the first one from Dispatch.</p>
            ) : (
              <div className="grid gap-3 sm:gap-4 lg:grid-cols-3">
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

        <SectionCard eyebrow="Recent workflow" title="Communication activity" description="Recent approval/payment communication records.">
          <div className="space-y-3 text-sm text-zinc-300">
            {emailLog.length === 0 ? (
              <div className="flex items-start gap-3 rounded-2xl border border-[#2d7dff]/20 bg-black/40 p-4">
                <Mail className="mt-0.5 h-5 w-5 shrink-0 text-[#8ffafa]" />
                <span>No communication events logged yet.</span>
              </div>
            ) : (
              emailLog.map((entry) => (
                <div key={entry.id} className="flex items-start gap-3 rounded-2xl border border-[#2d7dff]/20 bg-black/40 p-4">
                  <ClipboardList className="mt-0.5 h-5 w-5 shrink-0 text-[#8ffafa]" />
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
    </AppShell>
  );
}
