import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import { createServiceRoleClient } from "@/lib/supabase/service-client";

export const dynamic = "force-dynamic";

function pretty(value: unknown) {
  if (value == null) return null;
  try {
    const text = JSON.stringify(value, null, 2);
    return text.length > 1600 ? `${text.slice(0, 1600)}\n…` : text;
  } catch {
    return String(value);
  }
}

export default async function RevenueHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await getCurrentStaffProfile();
  if (!profile || !["manager", "office"].includes(profile.role)) redirect("/");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const client = createServiceRoleClient();
  const [{ data: lead, error: leadError }, { data: history, error: historyError }] = await Promise.all([
    client.from("chillbros_revenue_prospects").select("id,business_name").eq("id", id).maybeSingle(),
    client
      .from("chillbros_revenue_history")
      .select("id,entity_type,entity_id,action,actor_id,actor_type,previous_value,new_value,reason,created_at")
      .eq("lead_id", id)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  if (leadError || !lead) notFound();

  if (historyError) {
    return <AppShell title={`${lead.business_name} History`} description="Append-only Revenue Radar audit history.">
      <div className="mx-auto max-w-5xl space-y-4 text-left">
        <Link href={`/revenue-radar/${id}`} className="text-cyan-200">← Lead Detail</Link>
        <p className="rounded-2xl border border-amber-300/30 bg-amber-400/5 p-4 text-sm text-amber-100">
          Activity History is waiting for the additive Sales Command migration. Existing Revenue Radar data is unchanged.
        </p>
      </div>
    </AppShell>;
  }

  const actorIds = [...new Set((history ?? []).map((entry) => entry.actor_id).filter(Boolean))] as string[];
  const { data: actors } = actorIds.length
    ? await client.from("chillbros_profiles").select("id,full_name,role").in("id", actorIds)
    : { data: [] as Array<{ id: string; full_name: string; role: string }> };
  const actorMap = new Map((actors ?? []).map((actor) => [actor.id, actor]));

  return <AppShell title={`${lead.business_name} History`} description="Append-only sales, assignment, task, Battle Card, handoff, and compliance audit trail.">
    <div className="mx-auto max-w-5xl space-y-4 text-left">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={`/revenue-radar/${id}`} className="text-cyan-200">← Lead Detail</Link>
        <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-400">{history?.length ?? 0} most recent events</span>
      </div>

      <section className="rounded-2xl border border-cyan-300/20 bg-cyan-400/5 p-4 text-sm text-zinc-300">
        This log is read-only. Corrections create new audit events instead of changing prior records.
      </section>

      <div className="space-y-3">
        {(history ?? []).map((entry) => {
          const actor = entry.actor_id ? actorMap.get(entry.actor_id) : null;
          const previous = pretty(entry.previous_value);
          const next = pretty(entry.new_value);
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

            {entry.reason ? <p className="mt-3 rounded-xl border border-amber-300/15 bg-amber-400/5 p-3 text-sm text-amber-100"><span className="font-semibold">Reason:</span> {entry.reason}</p> : null}

            {(previous || next) ? <details className="mt-3 rounded-xl border border-white/10 bg-black/25 p-3">
              <summary className="cursor-pointer text-sm font-semibold text-zinc-200">Change details</summary>
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Previous</p>
                  <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-black/35 p-2 text-xs text-zinc-400">{previous || "—"}</pre>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">New</p>
                  <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-black/35 p-2 text-xs text-zinc-300">{next || "—"}</pre>
                </div>
              </div>
            </details> : null}
          </article>;
        })}

        {(history ?? []).length === 0 ? <div className="rounded-2xl border border-white/10 p-6 text-center text-sm text-zinc-500">No Sales Command audit events have been recorded for this lead yet.</div> : null}
      </div>
    </div>
  </AppShell>;
}
