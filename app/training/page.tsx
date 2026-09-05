import Link from "next/link";
import { BookOpenCheck, GraduationCap, Rotate3D, Search } from "lucide-react";
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
          <div className="space-y-4">
            <div className="flex items-start gap-3 text-sm leading-6 text-zinc-300"><BookOpenCheck className="mt-1 h-5 w-5 shrink-0 text-[#8ffafa]" /><p>Cases are training references, not automatic diagnoses. Field readings still have to prove the failure on the actual equipment.</p></div>
            <Link href="#bible-library" className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#8ffafa]/45 bg-[#2d7dff]/10 px-4 py-3 text-sm font-semibold text-white shadow-[0_0_12px_rgba(45,125,255,0.16)] sm:w-auto"><Search className="h-4 w-4 text-[#8ffafa]" />Search Bible Cases</Link>
          </div>
        </SectionCard>
        <SectionCard className="w-full min-w-0" eyebrow="3D models" title="Open equipment component walkthroughs" description="The Blender models are live. Choose a Bible case below, then tap the Open 3D Training Model button to rotate, zoom, and focus components.">
          <div className="space-y-4">
            <div className="flex items-start gap-3 text-sm leading-6 text-zinc-300"><GraduationCap className="mt-1 h-5 w-5 shrink-0 text-[#8ffafa]" /><p>Each solved field problem becomes a reusable visual lesson for the next technician.</p></div>
            <Link href="#bible-library" className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#8ffafa]/55 bg-[#2d7dff]/14 px-4 py-3 text-sm font-semibold text-white shadow-[0_0_14px_rgba(45,125,255,0.2)] sm:w-auto"><Rotate3D className="h-4 w-4 text-[#8ffafa]" />Browse 3D Training Models</Link>
          </div>
        </SectionCard>
      </div>
      <div id="bible-library" className="scroll-mt-28">
        <TrainingBibleLibrary cases={trainingCases} />
      </div>
    </AppShell>
  );
}
