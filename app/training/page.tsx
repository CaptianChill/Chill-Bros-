import { BookOpenCheck, GraduationCap } from "lucide-react";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { TrainingBibleLibrary } from "@/components/training-bible-library";
import { trainingCases } from "@/lib/chillbros/training-cases";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";

export const dynamic = "force-dynamic";

export default async function TrainingPage() {
  const profile = await getCurrentStaffProfile();
  if (!profile) redirect("/sign-in");

  return (
    <AppShell
      title="Training Center · Chill Bros Bible"
      description="Use real field cases, known readings, diagnostic sequences, and component walkthroughs to train the team and recognize future problems that match issues we have already solved."
      highlight={<div className="space-y-3"><p className="text-sm uppercase tracking-[0.3em] text-[#8ffafa]">Shared knowledge</p><StatusPill tone="emerald">All staff access</StatusPill><StatusPill>{trainingCases.length} starter cases</StatusPill></div>}
    >
      <div className="mb-4 grid w-full min-w-0 items-stretch gap-4 lg:grid-cols-2">
        <SectionCard className="w-full min-w-0" eyebrow="How to use it" title="Search the symptom before starting from zero" description="Enter the fault, reading, error code, or component. Similar Bible cases surface first so technicians can compare the current job to a proven diagnostic path.">
          <div className="flex items-start gap-3 text-sm leading-6 text-zinc-300"><BookOpenCheck className="mt-1 h-5 w-5 shrink-0 text-[#8ffafa]" /><p>Cases are training references, not automatic diagnoses. Field readings still have to prove the failure on the actual equipment.</p></div>
        </SectionCard>
        <SectionCard className="w-full min-w-0" eyebrow="3D roadmap" title="Every case maps to equipment components" description="The component list below each case already follows the Blender naming approach. Real GLB equipment models can replace the current training blocks without rewriting the Bible content.">
          <div className="flex items-start gap-3 text-sm leading-6 text-zinc-300"><GraduationCap className="mt-1 h-5 w-5 shrink-0 text-[#8ffafa]" /><p>That lets one solved problem become a reusable lesson for the next technician, instead of vanishing after the invoice closes.</p></div>
        </SectionCard>
      </div>
      <TrainingBibleLibrary cases={trainingCases} />
    </AppShell>
  );
}
