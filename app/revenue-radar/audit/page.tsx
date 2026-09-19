import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import { createServiceRoleClient } from "@/lib/supabase/service-client";

export const dynamic = "force-dynamic";

export default async function RevenueAuditPage() {
  const profile = await getCurrentStaffProfile();
  if (!profile || profile.role !== "manager") redirect("/");

  const client = createServiceRoleClient();
  const { data: history, error } = await client
    .from("chillbros_revenue_history")
    .select("id,lead_id,entity_type,action,actor_id,actor_type,reason,created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return <AppShell title="Revenue Radar Audit" description="Append-only Sales Command history.">
      <div className="mx-auto max-w-5xl space-y-4 text-left">
        <Link href="/revenue-radar" className="text-cyan-200">← Revenue Radar</Link>
        <p className="rounded-2xl border border-amber-300/30 bg-amber-400/5 p-4 text-sm text-amber-100">
          Audit History is waiting for the additive Sales Command migration. Existing Revenue Radar remains available.
        </p>
      </div>
    </AppShell>;
  }

  const leadIds = [...new Set((history ?? []).map((entry) => entry.lead_id).filter(Boolean))] as string[];
  const actorIds = [...new Set((history ?? []).map((entry) => entry.actor_id).filter(Boolean))] as string[];
  const [{ data: leads }, { data: actors }] = await Promise.all([
    leadIds.length ? client.from("chillbros_revenue_prospects").select("id,business_name").in("id", leadIds) : Promise.resolve({ data: [] }),
    actorIds.length ? client.from("chillbros_profiles").select("id,full_name,role").in("id", actorIds) : Promise.resolve({ data: [] }),
  ]);
  const leadMap = new Map((leads ?? []).map((lead) => [lead.id, lead.business_name]));
  const actorMap = new Map((actors ?? []).map((actor) => [actor.id, actor]));

  return <AppShell title="Revenue Radar Audit" description="Read-only history for assignments, Battle Cards, sales activity, tasks, handoffs, status changes, exports, and compliance controls.">
    <div className="mx-auto max-w-5xl space-y-4 text-left">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/revenue-radar" className="text-cyan-200">← Revenue Radar</Link>
        <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-400">{history?.length ?? 0} latest events</span>
      </div>

      <section className="rounded-2xl border border-cyan-300/20 bg-cyan-400/5 p-4 text-sm text-zinc-300">
        This audit surface is read-only. Historical events are never edited here; corrections must create a new event.
      </section>

      <div className="space-y-2">
        {(history ?? []).map((entry) => {
          const actor = entry.actor_id ? actorMap.get(entry.actor_id) : null;
          const leadName = entry.lead_id ? leadMap.get(entry.lead_id) : null;
          return <article key={entry.id} className="rounded-2xl border border-white/10 bg-black/35 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="text-white">{String(entry.action).replaceAll("_", " ")}</strong>
                  <span className="rounded-full border border-cyan-300/20 px-2 py-0.5 text-[11px] text-cyan-200">{String(entry.entity_type).replaceAll("_", " ")}</span>
                </div>
                <p className="mt-1 text-xs text-zinc-500">
                  {actor ? `${actor.full_name} · ${actor.role}` : entry.actor_type === "system" ? "System automation" : "Unknown / historical actor"}
                </p>
              </div>
              <time className="text-xs text-zinc-500">{new Date(entry.created_at).toLocaleString()}</time>
            </div>

            {entry.lead_id ? <Link href={`/revenue-radar/${entry.lead_id}/history`} className="mt-3 inline-block text-sm font-semibold text-cyan-200 underline underline-offset-2">{leadName || "Open lead history"}</Link> : null}
            {entry.reason ? <p className="mt-2 text-sm text-amber-100"><span className="font-semibold">Reason:</span> {entry.reason}</p> : null}
          </article>;
        })}

        {(history ?? []).length === 0 ? <div className="rounded-2xl border border-white/10 p-6 text-center text-sm text-zinc-500">No Sales Command audit events have been recorded yet.</div> : null}
      </div>
    </div>
  </AppShell>;
}
