import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { RevenueRadarCloseScript } from "@/components/revenue-radar-close-script";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import { createServiceRoleClient } from "@/lib/supabase/service-client";
import { updateProspect } from "../actions";

export const dynamic = "force-dynamic";
const input = "min-h-11 w-full rounded-xl border border-cyan-400/30 bg-black/50 px-3 py-2 text-white";

export default async function ProspectPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await getCurrentStaffProfile();
  if (!profile || !["manager", "office"].includes(profile.role)) redirect("/");
  const { id } = await params;
  const { data: p } = await createServiceRoleClient().from("chillbros_revenue_prospects").select("*").eq("id", id).maybeSingle();
  if (!p) notFound();

  const field = (label: string, name: string, type = "text") => <label key={name}>{label}<input className={input} name={name} type={type} defaultValue={p[name] ?? ""} /></label>;

  return <AppShell title={p.business_name} description="Lead details, next action, and a simple sales close.">
    <div className="mx-auto max-w-3xl space-y-4 text-left">
      <Link href="/revenue-radar" className="text-cyan-200">← Revenue Radar</Link>

      <section className="rounded-2xl border border-cyan-400/25 bg-black/40 p-4">
        <div className="flex justify-between gap-3">
          <h2 className="text-xl font-bold">{p.score}/100 · {p.service_line.replaceAll("_", " ")}</h2>
          <span className="text-sm text-cyan-200">{p.status}</span>
        </div>
        <p className="mt-2">{p.signal_summary}</p>
        <p className="mt-2 text-sm text-amber-200">{p.signal_verified ? "Verified directly" : "Public lead signal; confirm details before stating them as fact"}</p>
        <a className="mt-2 block text-sm text-cyan-200 underline" href={p.source_url} target="_blank" rel="noreferrer">View lead source ↗</a>
      </section>

      <form action={updateProspect} className="space-y-4">
        <input type="hidden" name="id" value={id} />

        <section className="grid gap-3 rounded-2xl border border-cyan-400/25 bg-black/40 p-4 sm:grid-cols-2">
          <h2 className="font-semibold sm:col-span-2">Contact & next move</h2>
          {field("Name", "contact_name")}
          {field("Role", "contact_role")}
          {field("Email", "contact_email", "email")}
          {field("Phone", "contact_phone", "tel")}
          <label>Status<select className={input} name="status" defaultValue={p.status}>{["new","research","approved","skipped","contacted","quoted","won","lost"].map(s => <option key={s} value={s}>{s.replaceAll("_", " ")}</option>)}</select></label>
          <label>Follow up<input className={input} type="datetime-local" name="follow_up_at" defaultValue={p.follow_up_at ? new Date(p.follow_up_at).toISOString().slice(0,16) : ""} /></label>
          <label className="sm:col-span-2">Next step<textarea className={input} name="follow_up_note" defaultValue={p.follow_up_note ?? ""} rows={2} /></label>
        </section>

        <details className="rounded-2xl border border-white/10 bg-black/30 p-4">
          <summary className="cursor-pointer font-semibold text-zinc-300">Email & revenue details</summary>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {field("Email subject", "email_subject")}
            <label className="sm:col-span-2">Email draft<textarea className={input} name="email_draft" defaultValue={p.email_draft ?? ""} rows={4} /></label>
            {field("Recipient business address", "business_address")}
            {field("Chill Pros postal address", "sender_postal_address")}
            <label className="sm:col-span-2">Opt-out instructions<input className={input} name="unsubscribe_instructions" defaultValue={p.unsubscribe_instructions ?? "Reply 'unsubscribe' to opt out."} /></label>
            {field("Job ID", "job_id")}
            {field("Quote / invoice ID", "invoice_id")}
            {field("Estimated revenue", "estimated_revenue", "number")}
            {field("Actual revenue", "actual_revenue", "number")}
            {field("Direct cost", "direct_cost", "number")}
            <p className="self-end text-cyan-200">Gross profit: ${((Number(p.actual_revenue) || 0) - (Number(p.direct_cost) || 0)).toFixed(2)}</p>
          </div>
        </details>

        <button className="min-h-11 w-full rounded-xl bg-cyan-300 px-4 font-semibold text-black">Save lead</button>
      </form>

      <RevenueRadarCloseScript
        businessName={p.business_name}
        serviceLine={p.service_line}
        signalSummary={p.signal_summary}
        signalVerified={p.signal_verified}
        contactName={p.contact_name}
      />
    </div>
  </AppShell>;
}
