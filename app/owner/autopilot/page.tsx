import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { AutopilotControls } from "@/components/autopilot/autopilot-controls";
import { SectionCard } from "@/components/section-card";
import { getAutopilotDashboard } from "@/lib/chillbros/autopilot/dashboard-queries";
import { getOwnerProfile } from "@/lib/chillbros/sent-invoice-history";

export const dynamic = "force-dynamic";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const LANE: Record<string, string> = { cold: "Cold email", reactivation: "Check-in", inbound: "Inbound reply", enrichment: "Lead finder" };

function when(value: string) {
  return new Date(value).toLocaleString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function Stat({ label, value, tone = "default" }: { label: string; value: string | number; tone?: "default" | "good" | "warn" }) {
  const ring = tone === "good" ? "border-emerald-400/30 bg-emerald-400/5" : tone === "warn" ? "border-amber-400/30 bg-amber-400/5" : "border-[#2d7dff]/25 bg-black/40";
  return (
    <div className={`rounded-2xl border p-3 text-left ${ring}`}>
      <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}

export default async function AutopilotDashboardPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  if (!(await getOwnerProfile())) redirect("/");
  const { days: daysParam } = await searchParams;
  const days = [7, 30, 90].includes(Number(daysParam)) ? Number(daysParam) : 30;
  const d = await getAutopilotDashboard(days);
  const s = d.settings;

  return (
    <AppShell title="Lead Autopilot">
      <div className="space-y-4">
        <div className="flex justify-center gap-2">
          {[7, 30, 90].map((n) => (
            <Link key={n} href={`/owner/autopilot?days=${n}`} className={`rounded-full border px-4 py-1.5 text-sm font-semibold ${n === days ? "border-[#8ffafa] bg-[#2d7dff]/20 text-white" : "border-zinc-600 text-zinc-300"}`}>{n} days</Link>
          ))}
        </div>

        <SectionCard eyebrow={`Last ${days} days`} title="Money" description="Jobs customers booked themselves through Autopilot, and what those jobs have billed and collected.">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Booked jobs" value={d.money.bookedJobs} tone={d.money.bookedJobs ? "good" : "default"} />
            <Stat label="Invoiced" value={money.format(d.money.invoiced)} />
            <Stat label="Collected" value={money.format(d.money.paid)} tone={d.money.paid ? "good" : "default"} />
            <Stat label="Collected minus Autopilot cost" value={money.format(d.money.profitPaid)} tone={d.money.profitPaid > 0 ? "good" : "default"} />
          </div>
          <p className="mt-2 text-xs text-zinc-500">Autopilot running cost (AI writing and texts) is estimated at {money.format(d.money.estCost)} for this period. Labor and parts aren&apos;t subtracted here.</p>
        </SectionCard>

        <SectionCard eyebrow="Pipeline" title="Leads and outreach" description="What the machine found and sent.">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Businesses with email" value={d.leads.prospectsWithEmail} />
            <Stat label={`Emails found (${days}d)`} value={d.leads.foundThisPeriod} />
            <Stat label="In a sequence now" value={d.leads.inSequence} />
            <Stat label="Inbound leads" value={d.leads.inboundLeads} />
            <Stat label="Cold emails sent" value={d.sent.cold} />
            <Stat label="Check-ins sent" value={d.sent.reactivation} />
            <Stat label="Inbound replies sent" value={d.sent.inbound} />
            <Stat label="Open slots (5 days)" value={d.openSlots5Days} tone={d.openSlots5Days === 0 ? "warn" : "default"} />
          </div>
          <p className="mt-2 text-xs text-zinc-500">{d.leads.unsubscribed} contacts have unsubscribed and are never emailed again. When open slots hit zero, outreach pauses on its own.</p>
        </SectionCard>

        <SectionCard eyebrow="Booked by Autopilot" title="Bookings" description="Newest first.">
          {d.bookings.length ? (
            <ul className="divide-y divide-zinc-800 text-left">
              {d.bookings.map((b) => (
                <li key={b.jobId}>
                  <Link href={`/jobs/${b.jobId}`} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="min-w-0"><span className="block truncate font-semibold text-white">{b.customerName}</span><span className="block text-xs text-zinc-400">{b.jobNumber ?? "Job"} · {b.window ?? "unscheduled"} · {b.status.replace(/_/g, " ")}</span></span>
                    <span className="shrink-0 text-right text-sm"><span className="block text-white">{money.format(b.paid)} collected</span><span className="block text-xs text-zinc-400">{money.format(b.invoiced)} invoiced</span></span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-zinc-400">No bookings yet in this period. The first cold emails go out Monday 2pm; customer check-ins start Tuesday morning.</p>}
        </SectionCard>

        <SectionCard eyebrow="Owner only" title="Controls" description="Turn lanes on or off and set daily limits. Changes apply at the next hourly run.">
          <AutopilotControls
            initial={{ enabled: s.enabled, inbound_enabled: s.inbound_enabled, reactivation_enabled: s.reactivation_enabled, cold_email_enabled: s.cold_email_enabled, hood_cleaning_active: s.hood_cleaning_active }}
            caps={{ cold: s.cold_daily_cap, reactivation: s.reactivation_daily_cap }}
          />
        </SectionCard>

        <SectionCard eyebrow="Latest" title="Recent activity" description="The last 25 things Autopilot did.">
          {d.activity.length ? (
            <ul className="divide-y divide-zinc-800 text-left text-sm">
              {d.activity.map((a, i) => (
                <li key={`${a.at}-${i}`} className="flex items-start justify-between gap-3 py-2">
                  <span className="min-w-0"><span className="block truncate text-white">{a.subject ?? LANE[a.lane] ?? a.lane}</span><span className="block truncate text-xs text-zinc-400">{LANE[a.lane] ?? a.lane}{a.recipient ? ` · ${a.recipient}` : ""}</span></span>
                  <span className="shrink-0 text-right text-xs"><span className={`block font-semibold ${a.status === "sent" ? "text-emerald-300" : a.status === "failed" ? "text-red-300" : "text-amber-200"}`}>{a.status.replace(/_/g, " ")}</span><span className="block text-zinc-500">{when(a.at)}</span></span>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-zinc-400">Nothing yet. The lead finder runs every hour.</p>}
        </SectionCard>
      </div>
    </AppShell>
  );
}
