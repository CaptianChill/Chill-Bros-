import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { displayTime, parseWindow } from "@/lib/chillbros/schedule-window";
import { JOB_STATUS_LABELS, type JobStatus } from "@/lib/chillbros/types";
import { getTechnicianJobHistory } from "@/lib/chillbros/work-page-queries";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";

export const dynamic = "force-dynamic";

function when(job: { scheduledWindow: string | null; updatedAt: string }) {
  const slot = parseWindow(job.scheduledWindow);
  if (slot) return `${new Date(`${slot.date}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" })} · ${displayTime(slot.start)}`;
  return new Date(job.updatedAt).toLocaleDateString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", year: "numeric" });
}

// A technician's own finished calls. Owner reporting is unaffected: these
// jobs stay in every office report; they just leave the tech's active lists.
export default async function TechnicianHistoryPage() {
  const profile = await getCurrentStaffProfile();
  if (!profile) redirect("/sign-in");
  if (profile.role !== "technician" && profile.role !== "manager") redirect("/");
  const jobs = await getTechnicianJobHistory(profile.id);

  return (
    <AppShell title="History" description="Your finished calls. Tap one to see its notes, photos, parts and sign-off.">
      <div className="cb-new">
        <section aria-labelledby="history-title" className="cb-work-card overflow-hidden">
          <h2 id="history-title" className="border-b border-[#0A1A33]/10 px-3.5 py-3 text-xl font-bold">Completed jobs ({jobs.length})</h2>
          {jobs.length === 0 ? (
            <p className="px-3.5 py-4 text-sm font-medium text-[#2B3F5C]">No completed jobs yet.</p>
          ) : (
            <ul className="divide-y divide-[#0A1A33]/10">
              {jobs.map((job) => (
                <li key={job.id}>
                  <Link href={`/jobs/${job.id}`} className="flex min-h-[64px] items-center gap-3 px-3.5 py-2.5 hover:bg-[#F0F5FC]">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold">{job.customerName}</span>
                      <span className="block truncate text-[13px] font-medium text-[#2B3F5C]">{when(job)} · {job.scope?.trim() || "Service call"}</span>
                    </span>
                    <span className="shrink-0 rounded-full bg-[#E8EEF6] px-2.5 py-1 text-xs font-semibold text-[#3A5A85]">{JOB_STATUS_LABELS[job.status as JobStatus] ?? job.status}</span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-[#2B3F5C]" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}
