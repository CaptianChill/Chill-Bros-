import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { DiagnosticReadingsPanel } from "@/components/diagnostic-readings-panel";
import { SectionCard } from "@/components/section-card";
import { getDiagnosticReadings } from "@/lib/chillbros/diagnostic-readings";
import { getJob } from "@/lib/chillbros/queries";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
export const dynamic="force-dynamic";
export default async function DiagnosticsPage({params}:{params:Promise<{id:string}>}){const [{id},profile]=await Promise.all([params,getCurrentStaffProfile()]);if(!profile)redirect("/sign-in");const [job,readings]=await Promise.all([getJob(id),getDiagnosticReadings(id)]);if(!job)notFound();if(profile.role==="technician"&&job.assignedTechId!==profile.id)redirect("/technician");return <AppShell title="Field Diagnostics" description={`${job.customerName} · structured readings stay with this permanent job and its linked equipment.`}><div className="space-y-4"><Link href={`/jobs/${id}`} className="inline-flex rounded-xl border border-[#2d7dff]/25 px-3 py-2 text-sm text-[#d9fbff]">← Job workspace</Link><SectionCard eyebrow="Phase 4 · Field data" title="Structured diagnostic readings" description="Record pressures, temperatures, electrical values and combustion readings in reusable fields instead of burying them in free-text notes."><DiagnosticReadingsPanel jobId={id} readings={readings}/></SectionCard></div></AppShell>}