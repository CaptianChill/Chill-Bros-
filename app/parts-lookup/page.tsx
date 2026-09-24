import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { SectionCard } from "@/components/section-card";
import { PartsLookupForm } from "@/components/parts-lookup-form";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";

export const dynamic = "force-dynamic";
export const maxDuration = 240;

type Props = { searchParams: Promise<{ brand?: string; model?: string; serial?: string; details?: string; back?: string }> };

const clip = (value: string | undefined, max: number) => (value ?? "").slice(0, max);

export default async function PartsLookupPage({ searchParams }: Props) {
  const profile = await getCurrentStaffProfile();
  if (!profile) redirect("/sign-in");
  if (!["manager", "technician", "office"].includes(profile.role)) redirect("/");

  const params = await searchParams;
  // Only same-app paths, so the back link can't point somewhere else.
  const back = params.back?.startsWith("/") && !params.back.startsWith("//") ? params.back : null;
  const prefill = { brand: clip(params.brand, 120), model: clip(params.model, 120), serial: clip(params.serial, 120), details: clip(params.details, 1000) };

  return <AppShell title="Parts Pro" description="AI help finding OEM part numbers, manuals and parts desks by model and serial.">
    <div className="mx-auto max-w-4xl space-y-4">
      {back ? (
        <Link href={back} className="cb-new cb-card inline-flex min-h-11 items-center gap-1 px-3.5 font-semibold text-[#1557B0]">
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Back
        </Link>
      ) : null}
      <SectionCard title="Parts Pro">
        <PartsLookupForm prefill={prefill} />
      </SectionCard>
    </div>
  </AppShell>;
}
