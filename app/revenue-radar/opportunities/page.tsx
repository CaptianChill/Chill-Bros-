import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import { createServiceRoleClient } from "@/lib/supabase/service-client";
import { closeRevenueOpportunity, reopenRevenueOpportunity } from "../opportunity-actions";

export const dynamic = "force-dynamic";
const input = "min-h-11 w-full rounded-xl border border-cyan-400/30 bg-black/50 px-3 py-2 text-white";

const ACTIVE_CLOSEOUT_STATUSES = ["qualified", "technician_needed", "appointment_set", "proposal_requested"];

export default async function RevenueOpportunitiesPage() {
  const profile = await getCurrentStaffProfile();
  if (!profile || profile.role !== "manager") redirect("/");

  const client = createServiceRoleClient();
  const { data: leads, error } = await client
    .from("chillbros_revenue_prospects")
    .select("id,business_name,city,score,sales_status,assigned_salesperson,estimated_revenue,actual_revenue,status_reason,last_activity_at,follow_up_at,do_not_contact,contact_name,contact_phone")
    .order("last_activity_at", { ascending: false, nullsFirst: false })
    .limit(150);

  if (error) {
    return <AppShell title="Sales Closeout" description="Revenue Radar opportunity outcomes and revenue attribution.">
      <div className="mx-auto max-w-5xl text-left">
        <p className="rounded-2xl border border-amber-300/30 bg-amber-400/5 p-4 text-sm text-amber-100">Sales Closeout is waiting for the additive Sales Command schema. Existing Revenue Radar data is unchanged.</p>
      </div>
    </AppShell>;
  }

  const rows = leads ?? [];
  const staffIds = [...new Set(rows.map((lead) => lead.assigned_salesperson).filter(Boolean))] as string[];
  const { data: staff } = staffIds.length
    ? await client.from("chillbros_profiles").select("id,full_name").in("id", staffIds)
    : { data: [] as Array<{ id: string; full_name: string }> };
  const staffNames = new Map((staff ?? []).map((member) => [member.id, member.full_name]));

  const active = rows.filter((lead) => ACTIVE_CLOSEOUT_STATUSES.includes(lead.sales_status));
  const closed = rows.filter((lead) => ["won", "lost"].includes(lead.sales_status));
  const proposalValue = active.reduce((sum, lead) => sum + (Number(lead.estimated_revenue) || 0), 0);
  const wonRevenue = closed.filter((lead) => lead.sales_status === "won").reduce((sum, lead) => sum + (Number(lead.actual_revenue) || 0), 0);
  const wonCount = closed.filter((lead) => lead.sales_status === "won").length;
  const lostCount = closed.filter((lead) => lead.sales_status === "lost").length;

  return <AppShell title="Sales Closeout" description="Manager-controlled Won/Lost decisions, revenue attribution, and auditable corrections.">
    <div className="mx-auto max-w-6xl space-y-5 text-left">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/revenue-radar" className="text-cyan-200">← Revenue Radar</Link>
        <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-400">Manager only</span>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <Link href="/revenue-radar/tasks" className="rounded-full border border-white/15 px-3 py-1.5 text-zinc-300 hover:border-cyan-300/50 hover:text-white">Sales tasks</Link>
        <Link href="/revenue-radar/handoffs" className="rounded-full border border-white/15 px-3 py-1.5 text-zinc-300 hover:border-cyan-300/50 hover:text-white">Technician handoffs</Link>
        <Link href="/revenue-radar/audit" className="rounded-full border border-white/15 px-3 py-1.5 text-zinc-300 hover:border-cyan-300/50 hover:text-white">Sales audit</Link>
        <Link href="/revenue-radar/dnc" className="rounded-full border border-white/15 px-3 py-1.5 text-zinc-300 hover:border-cyan-300/50 hover:text-white">DNC review</Link>
      </div>

      <section className="rounded-3xl border border-cyan-300/25 bg-cyan-400/5 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">Controlled closeout</p>
        <h2 className="mt-1 text-xl font-semibold text-white">A person closes the deal. The AI does not.</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-300">Won/Lost requires a manager reason. Won also requires actual revenue so Revenue Radar can measure what the pipeline really produced. Closing sales follow-up never cancels an active technician handoff review.</p>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-black/30 p-3 text-center"><strong className="block text-xl text-white">{active.length}</strong><span className="text-xs text-zinc-400">Closeout ready</span></div>
          <div className="rounded-2xl border border-white/10 bg-black/30 p-3 text-center"><strong className="block text-xl text-white">${proposalValue.toLocaleString()}</strong><span className="text-xs text-zinc-400">Est. active value</span></div>
          <div className="rounded-2xl border border-white/10 bg-black/30 p-3 text-center"><strong className="block text-xl text-emerald-200">{wonCount} · ${wonRevenue.toLocaleString()}</strong><span className="text-xs text-zinc-400">Won / revenue</span></div>
          <div className="rounded-2xl border border-white/10 bg-black/30 p-3 text-center"><strong className="block text-xl text-zinc-200">{lostCount}</strong><span className="text-xs text-zinc-400">Lost</span></div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between"><h2 className="text-lg font-semibold text-white">Ready for manager decision</h2><span className="text-xs text-zinc-500">{active.length} opportunities</span></div>
        {active.map((lead) => <article key={lead.id} className="rounded-2xl border border-white/10 bg-black/35 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <Link href={`/revenue-radar/${lead.id}`} className="font-bold text-white underline decoration-cyan-300/30 underline-offset-4">{lead.business_name}</Link>
              <p className="mt-1 text-sm text-zinc-400">{lead.city} · {String(lead.sales_status).replaceAll("_", " ")} · {staffNames.get(lead.assigned_salesperson) || "Unassigned"}</p>
              <p className="mt-1 text-xs text-zinc-500">Score {lead.score}/100{lead.contact_name ? ` · ${lead.contact_name}` : ""}{lead.contact_phone ? ` · ${lead.contact_phone}` : ""}</p>
            </div>
            <div className="text-right text-sm"><p className="text-zinc-500">Estimated</p><strong className="text-cyan-200">${(Number(lead.estimated_revenue) || 0).toLocaleString()}</strong></div>
          </div>
          {lead.do_not_contact ? <p className="mt-3 rounded-xl border border-red-300/30 bg-red-400/5 p-2 text-xs font-semibold text-red-100">Do Not Contact is active. Closeout is still available for historical attribution; reopening outreach requires DNC review.</p> : null}
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <form action={closeRevenueOpportunity} className="rounded-xl border border-emerald-300/20 bg-emerald-400/5 p-3">
              <input type="hidden" name="lead_id" value={lead.id} /><input type="hidden" name="outcome" value="won" />
              <p className="text-xs font-semibold uppercase text-emerald-200">Mark Won</p>
              <label className="mt-2 block text-sm">Actual revenue<input className={input} name="actual_revenue" type="number" min="0" step="0.01" required defaultValue={lead.actual_revenue ?? ""} /></label>
              <label className="mt-2 block text-sm">Closeout reason<textarea className={`${input} resize-y`} name="reason" rows={2} required placeholder="What was approved, sold, or booked?" /></label>
              <button className="mt-2 min-h-11 w-full rounded-xl bg-emerald-300 px-4 font-bold text-black">Confirm Won</button>
            </form>
            <form action={closeRevenueOpportunity} className="rounded-xl border border-zinc-500/30 bg-black/25 p-3">
              <input type="hidden" name="lead_id" value={lead.id} /><input type="hidden" name="outcome" value="lost" />
              <p className="text-xs font-semibold uppercase text-zinc-300">Mark Lost</p>
              <label className="mt-2 block text-sm">Loss reason<textarea className={`${input} resize-y`} name="reason" rows={3} required placeholder="Price, incumbent vendor, no need, no response, timing..." /></label>
              <button className="mt-2 min-h-11 w-full rounded-xl border border-zinc-400/40 px-4 font-semibold text-zinc-100">Confirm Lost</button>
            </form>
          </div>
        </article>)}
        {active.length === 0 ? <p className="rounded-2xl border border-white/10 p-5 text-center text-sm text-zinc-500">No qualified, technician-needed, appointment-set, or proposal-requested opportunities are waiting for closeout.</p> : null}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between"><h2 className="text-lg font-semibold text-white">Closed opportunities</h2><span className="text-xs text-zinc-500">{closed.length} recorded</span></div>
        {closed.map((lead) => <article key={lead.id} className={`rounded-2xl border p-4 ${lead.sales_status === "won" ? "border-emerald-300/20 bg-emerald-400/5" : "border-white/10 bg-black/30"}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><Link href={`/revenue-radar/${lead.id}`} className="font-bold text-white underline decoration-cyan-300/30 underline-offset-4">{lead.business_name}</Link><p className="mt-1 text-sm text-zinc-400">{staffNames.get(lead.assigned_salesperson) || "Unassigned"} · {lead.sales_status}</p></div>
            <div className="text-right"><strong className={lead.sales_status === "won" ? "text-emerald-200" : "text-zinc-300"}>{lead.sales_status.toUpperCase()}</strong>{lead.sales_status === "won" ? <p className="text-sm text-emerald-100">${(Number(lead.actual_revenue) || 0).toLocaleString()}</p> : null}</div>
          </div>
          {lead.status_reason ? <p className="mt-2 text-sm text-zinc-300">{lead.status_reason}</p> : null}
          <details className="mt-3 rounded-xl border border-white/10 bg-black/25 p-3"><summary className="cursor-pointer text-sm font-semibold text-zinc-300">Manager correction / reopen</summary>
            <form action={reopenRevenueOpportunity} className="mt-3 flex flex-col gap-2 sm:flex-row"><input type="hidden" name="lead_id" value={lead.id} /><input className={input} name="reason" required placeholder="Why is this closeout being corrected?" /><button className="min-h-11 rounded-xl border border-amber-300/30 px-4 font-semibold text-amber-100">Reopen</button></form>
          </details>
        </article>)}
        {closed.length === 0 ? <p className="rounded-2xl border border-white/10 p-5 text-center text-sm text-zinc-500">No Won/Lost opportunities have been recorded yet.</p> : null}
      </section>
    </div>
  </AppShell>;
}
