import { redirect } from "next/navigation";

import Link from "next/link";
import { signOutAction } from "@/app/sign-in/actions";
import { LogoBadge } from "@/components/logo-badge";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { FieldNotesIntakeForm } from "@/components/field-notes-intake-form";
import { getCustomers } from "@/lib/chillbros/queries";
import { getAssignedFieldJobsForTechnician } from "@/lib/chillbros/technician-assignment";
import { getDispatchJobs } from "@/lib/chillbros/operations-queries";
import { JOB_ACTIVE_STATUSES } from "@/lib/chillbros/types";
import { getTechnicianFieldNotes } from "@/lib/chillbros/field-notes-queries";
import { FIELD_NOTE_STATUS_LABELS } from "@/lib/chillbros/field-notes-types";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const STATUS_TONE = {
  submitted: "cyan",
  processing: "cyan",
  needs_review: "amber",
  ready: "cyan",
  approved: "emerald",
  completed: "emerald",
  processing_failed: "rose",
} as const;

export default async function FieldNotesPage() {
  const profile = await getCurrentStaffProfile();
  if (!profile) redirect("/sign-in?next=/field-notes");
  if (!["technician", "manager"].includes(profile.role)) redirect("/");

  const allJobs = profile.role === "manager" ? await getDispatchJobs(250) : await getAssignedFieldJobsForTechnician({ id: profile.id, email: profile.email, fullName: profile.fullName }, 250);
  const jobs = allJobs
    .filter((job) => JOB_ACTIVE_STATUSES.includes(job.status))
    .map((job) => ({ id: job.id, customerId: job.customerId, customerName: job.customerName, location: job.location }));

  const [customers, recent] = await Promise.all([getCustomers(), getTechnicianFieldNotes(profile.id, 10)]);

  return (
    <main className="mx-auto min-h-screen max-w-xl space-y-4 px-4 pb-8 pt-4 text-white">
      <header className="flex items-center justify-between gap-3">
        <LogoBadge variant="full" className="w-12" />
        <Link href={profile.role === "manager" ? "/owner/field-notes" : "/technician"} className="py-3 text-sm text-cyan-200">{profile.role === "manager" ? "Review inbox" : "My jobs"}</Link>
        <form action={signOutAction}><button type="submit" className="min-h-11 px-3 text-sm">Sign out</button></form>
      </header>
      <div className="space-y-4">
        <SectionCard title="Send to office">
          <FieldNotesIntakeForm
            technicianName={profile.fullName}
            profileId={profile.id}
            jobs={jobs.map((job) => ({ id: job.id, customerId: job.customerId, customerName: job.customerName, location: job.location }))}
            customers={customers.map((customer) => ({ id: customer.id, name: customer.name }))}
          />
        </SectionCard>

        <SectionCard title="Recent submissions">
          {recent.length === 0 ? <p className="text-sm text-zinc-500">Nothing submitted yet.</p> : (
            <div className="space-y-2 text-left">
              {recent.map((item) => (
                <div key={item.id} className="rounded-2xl border border-[#2d7dff]/15 bg-black/40 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-white">{item.customerName ?? item.customerNameFreeform ?? "Customer"}</p>
                    <StatusPill tone={STATUS_TONE[item.status]}>{FIELD_NOTE_STATUS_LABELS[item.status]}</StatusPill>
                  </div>
                  <p className="mt-1 text-xs text-zinc-400">{item.status === "completed" && item.imageCount === 0 ? "Verified text saved · Photos removed" : `${item.imageCount} photo${item.imageCount === 1 ? "" : "s"}`} · {new Date(item.submittedAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </main>
  );
}
