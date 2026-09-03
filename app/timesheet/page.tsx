import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { SectionCard } from "@/components/section-card";
import { TimesheetPanel } from "@/components/timesheet-panel";
import { StatusPill } from "@/components/status-pill";
import { getOpenTimesheet, getTimesheetHistory } from "@/lib/chillbros/operations-queries";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";

export const dynamic = "force-dynamic";

function central(value: string | null) {
  if (!value) return "Open";
  return new Date(value).toLocaleString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
}

export default async function TimesheetPage() {
  const profile = await getCurrentStaffProfile();
  if (!profile) redirect("/sign-in");

  if (profile.role === "manager") {
    const rows = await getTimesheetHistory(150);
    const totalHours = rows.reduce((sum, row) => sum + row.laborHours + row.driveHours, 0);
    return (
      <AppShell title="Review technician clock records, labor hours, and drive time." description="Manager timesheet history shows recent field sessions in Central Time with labor and drive allocation." highlight={<div className="space-y-3"><p className="text-sm uppercase tracking-[0.3em] text-[#8ffafa]">Timesheet review</p><StatusPill tone="emerald">{rows.length} sessions</StatusPill><StatusPill>{totalHours.toFixed(1)} recorded hours</StatusPill></div>}>
        <SectionCard eyebrow="Manager review" title="Technician time history" description="Recent clock sessions, newest first.">
          {rows.length === 0 ? <p className="text-sm text-zinc-400">No timesheets yet.</p> : <div className="overflow-x-auto rounded-2xl border border-[#2d7dff]/20"><table className="min-w-full text-left text-sm text-zinc-300"><thead className="bg-[#2d7dff]/10 text-[#d9fbff]"><tr><th className="px-3 py-3">Technician</th><th className="px-3 py-3">Location</th><th className="px-3 py-3">Clock in</th><th className="px-3 py-3">Clock out</th><th className="px-3 py-3">Labor</th><th className="px-3 py-3">Drive</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-t border-[#2d7dff]/10"><td className="px-3 py-3 text-white">{row.technicianName}</td><td className="px-3 py-3">{row.location ?? "—"}</td><td className="px-3 py-3">{central(row.clockInAt)}</td><td className="px-3 py-3">{central(row.clockOutAt)}</td><td className="px-3 py-3">{row.laborHours.toFixed(2)}</td><td className="px-3 py-3">{row.driveHours.toFixed(2)}</td></tr>)}</tbody></table></div>}
        </SectionCard>
      </AppShell>
    );
  }

  const open = await getOpenTimesheet(profile.id);
  return (
    <AppShell title="Clock in once, refresh safely, and close the shift with labor and drive time." description="Open clock sessions are restored from Supabase, so closing the browser or refreshing no longer loses the active timesheet." highlight={<div className="space-y-3"><p className="text-sm uppercase tracking-[0.3em] text-[#8ffafa]">Field time</p><StatusPill tone={open ? "emerald" : "cyan"}>{open ? "Open session restored" : "Ready to clock in"}</StatusPill><StatusPill>Central Time / 12-hour display</StatusPill></div>}>
      <SectionCard eyebrow="Technician time capture" title="Daily mobile timesheet" description="Clock state persists in the database and links automatically to the assigned active job.">
        <TimesheetPanel initialOpen={open} />
      </SectionCard>
    </AppShell>
  );
}
