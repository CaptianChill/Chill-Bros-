import Link from "next/link";
import { notFound,redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { CustomerUnifiedTimeline } from "@/components/customer-unified-timeline";
import { SectionCard } from "@/components/section-card";
import { getCustomerProfile } from "@/lib/chillbros/customer-profile";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
export const dynamic="force-dynamic";
export default async function CustomerTimelinePage({params}:{params:Promise<{id:string}>}){const [{id},profile]=await Promise.all([params,getCurrentStaffProfile()]);if(!profile||!["manager","office"].includes(profile.role))redirect("/");const data=await getCustomerProfile(id);if(!data)notFound();return <AppShell title={`${data.customer.name} · Timeline`} description="Jobs and billing activity in one chronological customer record."><div className="space-y-4"><Link href={`/customers/${id}`} className="inline-flex rounded-xl border border-[#2d7dff]/25 px-3 py-2 text-sm text-[#d9fbff]">← Customer Center</Link><SectionCard eyebrow="Phase 5 · Universal record" title="Customer activity timeline" description="Service work and billing stay in one chronological history instead of separate scavenger hunts."><CustomerUnifiedTimeline data={data}/></SectionCard></div></AppShell>}