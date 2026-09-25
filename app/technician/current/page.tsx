import { redirect } from "next/navigation";

import { ctToday, parseWindow } from "@/lib/chillbros/schedule-window";
import { getAssignedFieldJobsForTechnician } from "@/lib/chillbros/technician-assignment";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";

export const dynamic = "force-dynamic";

// Order a technician's calls are "current": on site first, then driving,
// then today's next scheduled call.
const PRIORITY = ["repairing", "diagnosing", "arrived", "in_progress", "en_route", "dispatched"];

// "My Work" tab: open the Work Page for the call the technician is on now.
export default async function CurrentJobPage() {
  const profile = await getCurrentStaffProfile();
  if (!profile) redirect("/sign-in");
  if (profile.role !== "technician") redirect("/technician");

  const jobs = (await getAssignedFieldJobsForTechnician({ id: profile.id, email: profile.email, fullName: profile.fullName }, 250)).filter((job) => job.assignedTechId === profile.id);
  const today = ctToday();
  const onIt = jobs
    .filter((job) => PRIORITY.includes(job.status))
    .sort((a, b) => PRIORITY.indexOf(a.status) - PRIORITY.indexOf(b.status))[0];
  const nextToday = jobs
    .filter((job) => parseWindow(job.scheduledWindow)?.date === today)
    .sort((a, b) => (parseWindow(a.scheduledWindow)?.start ?? "").localeCompare(parseWindow(b.scheduledWindow)?.start ?? ""))[0];
  const target = onIt ?? nextToday;
  redirect(target ? `/jobs/${target.id}` : "/technician");
}
