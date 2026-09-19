import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import { createServiceRoleClient } from "@/lib/supabase/service-client";
import { updateProspect } from "../actions";
import { buildSafeBattleCard } from "@/lib/chillbros/revenue-sales";

export const dynamic = "force-dynamic";
const input = "min-h-11 w-full rounded-xl border border-cyan-400/30 bg-black/50 px-3 py-2 text-white";
export default async function ProspectPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await getCurrentStaffProfile();
  if (!profile || !["manager", "office"].includes(profile.role)) redirect("/");
  const { id } = await params;
  const { data: p } = await createServiceRoleClient().from("chillbros_revenue_prospects").select("*").eq("id", id).maybeSingle();
  if (!p) notFound();
  const battleCard = buildSafeBattleCard({
    businessName: p.business_name,
    city: p.city,
    businessType: p.category,
    score: Number(p.score),
    serviceLine: p.service_line,
    signalSummary: p.signal_summary,
    signalVerified: Boolean(p.signal_verified),
    sourceUrl: p.source_url,
    observedAt: p.signal_observed_at,
    businessAddress: p.business_address,
    contactName: p.contact_name,
    contactRole: p.contact_role,
    contactPhone: p.contact_phone,
    contactEmail: p.contact_email,
  });
  const field = (label: string, name: string, type = "text") => <label key={name}>{label}<input className={input} name={name} type={type} defaultValue={p[name] ?? ""} /></label>;
  return <AppShell title={p.business_name} description="Review evidence and decide the next office action."><div className="mx-auto max-w-3xl space-y-4 text-left">
    <Link href="/revenue-radar" className="text-cyan-200">← Revenue Radar</Link>
    <section className="rounded-2xl border border-cyan-400/25 bg-black/40 p-4"><div className="flex justify-between gap-3"><h2 className="text-xl font-bold">{p.score}/100 · {p.category.replaceAll("_", " ")}</h2><span className="text-sm text-cyan-200">{p.status}</span></div>
      <p className="mt-2">{p.signal_summary}</p><p className="mt-2 text-sm text-amber-200">{p.signal_verified ? "Verified directly" : "Unverified public signal; research before outreach"}</p>
      <p className="mt-2 text-sm text-zinc-400">Observed {new Date(p.signal_observed_at).toLocaleString()} · Added {new Date(p.created_at).toLocaleString()}</p>
      <a className="mt-2 block break-all text-cyan-200 underline" href={p.source_url} target="_blank" rel="noreferrer">Open source ↗</a>
    </section>
    <section className="rounded-2xl border border-cyan-300/40 bg-cyan-400/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200">Sales Assist</p><h2 className="text-xl font-bold text-white">Lead Battle Card</h2></div>
        <span className="rounded-full border border-cyan-300/30 px-3 py-1 text-xs text-cyan-100">Nontechnical sales guidance</span>
      </div>
      <p className="mt-3 text-sm leading-6 text-zinc-200">{battleCard.whyNow}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-black/30 p-3"><p className="text-xs uppercase text-zinc-400">Best contact</p><strong>{battleCard.primaryContactRole}</strong><p className="mt-1 text-xs text-zinc-400">Backups: {battleCard.backupContactRoles.join(" · ")}</p></div>
        <div className="rounded-xl border border-white/10 bg-black/30 p-3"><p className="text-xs uppercase text-zinc-400">Service angle</p><p className="text-sm">{battleCard.serviceAngle}</p></div>
      </div>
      <div className="mt-3 rounded-xl border border-cyan-300/20 bg-black/40 p-3"><p className="text-xs font-semibold uppercase text-cyan-200">Call opener</p><p className="mt-1 text-sm leading-6">{battleCard.callOpener}</p></div>
      <details className="mt-3 rounded-xl border border-white/10 bg-black/30 p-3"><summary className="cursor-pointer font-semibold">Discovery questions</summary><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-200">{battleCard.discoveryQuestions.map((q) => <li key={q}>{q}</li>)}</ul></details>
      <details className="mt-2 rounded-xl border border-white/10 bg-black/30 p-3"><summary className="cursor-pointer font-semibold">Objections & responses</summary><div className="mt-2 space-y-2 text-sm">{battleCard.objectionResponses.map((o) => <div key={o.objection}><strong>{o.objection}</strong><p className="text-zinc-300">{o.response}</p></div>)}</div></details>
      <div className="mt-3 rounded-xl border border-amber-300/30 bg-amber-400/5 p-3"><p className="text-xs font-semibold uppercase text-amber-200">Technician handoff</p><p className="mt-1 text-sm text-zinc-200">{battleCard.technicalHandoff}</p></div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div><p className="text-xs uppercase text-zinc-400">Verified facts</p><p className="mt-1 text-xs text-zinc-300">{battleCard.verifiedFacts.length} available</p></div>
        <div><p className="text-xs uppercase text-zinc-400">Inferences</p><p className="mt-1 text-xs text-zinc-300">{battleCard.reasonableInferences.length} clearly labeled</p></div>
        <div><p className="text-xs uppercase text-zinc-400">Missing</p><p className="mt-1 text-xs text-zinc-300">{battleCard.missingInformation.length} items to qualify</p></div>
      </div>
    </section>
    <form action={updateProspect} className="space-y-4"><input type="hidden" name="id" value={id} />
      <section className="grid gap-3 rounded-2xl border border-cyan-400/25 bg-black/40 p-4 sm:grid-cols-2"><h2 className="font-semibold sm:col-span-2">Decision maker and next step</h2>
        {field("Name", "contact_name")}{field("Role", "contact_role")}{field("Email", "contact_email", "email")}{field("Phone", "contact_phone", "tel")}
        <label>Status<select className={input} name="status" defaultValue={p.status}>{["new","research","approved","skipped","contacted","quoted","won","lost"].map(s => <option key={s} value={s}>{s.replaceAll("_", " ")}</option>)}</select></label>
        <label>Follow up at<input className={input} type="datetime-local" name="follow_up_at" defaultValue={p.follow_up_at ? new Date(p.follow_up_at).toISOString().slice(0,16) : ""} /></label>
        <label className="sm:col-span-2">Follow-up task<textarea className={input} name="follow_up_note" defaultValue={p.follow_up_note ?? ""} rows={2} /></label>
      </section>
      <section className="grid gap-3 rounded-2xl border border-cyan-400/25 bg-black/40 p-4 sm:grid-cols-2"><h2 className="font-semibold sm:col-span-2">Email draft · office approval required</h2>
        {field("Subject", "email_subject")}<div className="sm:col-span-2"><label>Draft<textarea className={input} name="email_draft" defaultValue={p.email_draft ?? ""} rows={5} /></label></div>
        {field("Recipient business address", "business_address")}{field("Chill Pros postal address", "sender_postal_address")}
        <label className="sm:col-span-2">Opt-out instructions<input className={input} name="unsubscribe_instructions" defaultValue={p.unsubscribe_instructions ?? "Reply 'unsubscribe' to opt out."} /></label>
        <p className="text-xs text-zinc-400 sm:col-span-2">Check the subject, sender identity, postal address, and opt-out text before sending outside this app. Saving never sends an email.</p>
      </section>
      <section className="grid gap-3 rounded-2xl border border-cyan-400/25 bg-black/40 p-4 sm:grid-cols-2"><h2 className="font-semibold sm:col-span-2">Revenue attribution</h2>
        {field("Job ID", "job_id")}{field("Quote or invoice ID", "invoice_id")}{field("Estimated revenue", "estimated_revenue", "number")}{field("Actual revenue", "actual_revenue", "number")}{field("Direct cost", "direct_cost", "number")}
        <p className="self-end text-cyan-200">Gross profit: ${((Number(p.actual_revenue) || 0) - (Number(p.direct_cost) || 0)).toFixed(2)}</p>
        {p.job_id ? <Link className="text-cyan-200 underline" href={`/jobs/${p.job_id}`}>Open linked job</Link> : null}
        {p.invoice_id ? <Link className="text-cyan-200 underline" href="/invoices">Open billing center</Link> : null}
      </section>
      <button className="min-h-11 w-full rounded-xl bg-cyan-300 px-4 font-semibold text-black">Save prospect</button>
    </form>
  </div></AppShell>;
}
