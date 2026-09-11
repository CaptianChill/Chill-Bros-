import Link from "next/link";
import type { CustomerProfileData } from "@/lib/chillbros/customer-profile";

export function CustomerUnifiedTimeline({ data }: { data: CustomerProfileData }) {
  const events = [
    ...data.jobs.map(j=>({key:`job-${j.id}`,at:j.createdAt,title:`${j.jobNumber} · ${j.status.replace(/_/g," ")}`,detail:j.scope || j.location || "Service call",href:`/jobs/${j.id}`,kind:"Job"})),
    ...data.documents.map(d=>({key:`doc-${d.id}`,at:d.updatedAt,title:`${d.invoiceNumber} · ${d.status.replace(/_/g," ")}`,detail:d.paymentStatus.replace(/_/g," "),href:`/invoices?focus=${encodeURIComponent(d.id)}`,kind:"Billing"})),
  ].sort((a,b)=>new Date(b.at).getTime()-new Date(a.at).getTime());
  return <div className="space-y-2">{events.length ? events.map(e=><Link key={e.key} href={e.href} className="block rounded-xl border border-[#2d7dff]/15 bg-black/40 p-3 hover:border-[#8ffafa]/35"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] uppercase tracking-[0.16em] text-[#8ffafa]">{e.kind}</p><p className="mt-1 font-medium text-white">{e.title}</p><p className="mt-1 text-sm text-zinc-400">{e.detail}</p></div><time className="shrink-0 text-xs text-zinc-500">{new Date(e.at).toLocaleDateString("en-US",{timeZone:"America/Chicago",month:"short",day:"numeric",year:"2-digit"})}</time></div></Link>):<p className="text-sm text-zinc-500">No customer activity yet.</p>}</div>;
}