import Link from "next/link";
import { BookOpenCheck, Box, Database, ScanLine, Sparkles, Wrench } from "lucide-react";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { EquipmentAdmin } from "@/components/equipment-admin";
import { TrainingBibleLibrary } from "@/components/training-bible-library";
import { getEquipment } from "@/lib/chillbros/equipment-queries";
import { getCustomers } from "@/lib/chillbros/queries";
import { trainingCases } from "@/lib/chillbros/training-cases";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";

export const dynamic = "force-dynamic";

const quickLinks = [
  { href: "#equipment", label: "Add Equipment", icon: Database },
  { href: "/scan-send", label: "Scan / Upload", icon: ScanLine },
  { href: "#library", label: "Service Guides", icon: BookOpenCheck },
  { href: "#training", label: "Training + 3D", icon: Box },
];

export default async function TrainingPage() {
  const profile = await getCurrentStaffProfile();
  if (!profile) redirect("/sign-in");

  const [customers, equipment] = await Promise.all([getCustomers(), getEquipment()]);

  return (
    <AppShell
      title="Tech Assist"
      description="One field workspace for equipment records, proven service knowledge, parts references, and training. AI assistance will sit on top of this data later instead of replacing it."
      highlight={<div className="grid grid-cols-2 gap-2 text-center text-xs"><span className="rounded-xl border border-[#2d7dff]/25 bg-black px-3 py-2">{equipment.length} assets</span><span className="rounded-xl border border-[#2d7dff]/25 bg-black px-3 py-2">{trainingCases.length} field cases</span></div>}
    >
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {quickLinks.map(({ href, label, icon: Icon }) => (
          <Link key={label} href={href} className="flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-[#2d7dff]/30 bg-[#020407] px-3 py-3 text-center text-sm font-semibold text-white shadow-[0_0_12px_rgba(45,125,255,.12)]">
            <Icon className="h-4 w-4 shrink-0 text-[#8ffafa]" />
            <span>{label}</span>
          </Link>
        ))}
      </div>

      <section className="mt-4 rounded-2xl border border-[#2d7dff]/35 bg-[#020407] p-4">
        <div className="flex items-start gap-3">
          <Wrench className="mt-0.5 h-5 w-5 shrink-0 text-[#8ffafa]" />
          <div>
            <h2 className="text-lg font-semibold text-white">Field knowledge first</h2>
            <p className="mt-1 text-sm leading-6 text-zinc-300">Search the equipment record or a proven case before starting from zero. Keep customer and payment details in the business record; save the technical lesson for the team.</p>
          </div>
        </div>
      </section>

      <details id="equipment" className="group mt-4 rounded-2xl border border-[#2d7dff]/30 bg-[#020407]">
        <summary className="flex min-h-16 list-none items-center justify-between gap-3 px-4 py-3">
          <div><p className="font-semibold text-white">Equipment Database</p><p className="text-xs text-zinc-400">Save model, serial, refrigerant and field notes</p></div><span className="text-sm text-[#8ffafa] group-open:hidden">Open</span><span className="hidden text-sm text-[#8ffafa] group-open:inline">Close</span>
        </summary>
        <div className="border-t border-[#2d7dff]/15 p-3 md:p-4"><EquipmentAdmin customers={customers} equipment={equipment} canDelete={profile.role === "manager"} /></div>
      </details>

      <details id="library" className="group mt-3 rounded-2xl border border-[#2d7dff]/30 bg-[#020407]" open>
        <summary className="flex min-h-16 list-none items-center justify-between gap-3 px-4 py-3">
          <div><p className="font-semibold text-white">Service Knowledge</p><p className="text-xs text-zinc-400">Symptoms, readings, parts and proven repair paths</p></div><span className="text-sm text-[#8ffafa] group-open:hidden">Open</span><span className="hidden text-sm text-[#8ffafa] group-open:inline">Close</span>
        </summary>
        <div className="border-t border-[#2d7dff]/15 p-3 md:p-4"><TrainingBibleLibrary cases={trainingCases} /></div>
      </details>

      <details id="training" className="group mt-3 rounded-2xl border border-[#2d7dff]/30 bg-[#020407]">
        <summary className="flex min-h-16 list-none items-center justify-between gap-3 px-4 py-3">
          <div><p className="font-semibold text-white">Training + 3D</p><p className="text-xs text-zinc-400">Interactive equipment exercises without another giant page</p></div><span className="text-sm text-[#8ffafa] group-open:hidden">Open</span><span className="hidden text-sm text-[#8ffafa] group-open:inline">Close</span>
        </summary>
        <div className="grid gap-2 border-t border-[#2d7dff]/15 p-3 sm:grid-cols-2">
          <Link href="#library" className="rounded-xl border border-[#2d7dff]/25 bg-black px-4 py-3 text-center text-sm font-semibold text-white">Open 3D case exercises</Link>
          {profile.role === "manager" ? <Link href="/3d-studio" className="rounded-xl border border-[#2d7dff]/25 bg-black px-4 py-3 text-center text-sm font-semibold text-white">Open 3D Studio</Link> : null}
        </div>
      </details>

      <section className="mt-3 rounded-2xl border border-[#2d7dff]/20 bg-[#020407] p-4">
        <div className="flex items-center gap-3"><Sparkles className="h-5 w-5 text-[#8ffafa]" /><div><p className="font-semibold text-white">AI Tech Assistant</p><p className="text-xs text-zinc-400">Coming later. It will query this equipment and service knowledge instead of guessing from thin air.</p></div></div>
      </section>
    </AppShell>
  );
}
