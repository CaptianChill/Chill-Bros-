import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import { createServiceRoleClient } from "@/lib/supabase/service-client";
import { TRADES, isTrade, tradeOpener } from "@/lib/chillbros/trade-fit";

export const dynamic = "force-dynamic";

// Call List: every lead Sales Prep marked ready_to_call, best fit first, with the
// phone, the plan to pitch and the first line to say. Tap a row for the full card.
type Row = {
  id: string; business_name: string; city: string; score: number; service_line: string; category: string | null;
  contact_phone: string | null; contact_email: string | null; email_subject: string | null; assigned_salesperson: string | null;
};
type Card = { lead_id: string; content: { fit?: { score?: number }; suggestedPlan?: { tier?: string }; callOpener?: unknown } };

const SERVICE: Record<string, string> = { hvac_r: "HVAC/R", refrigeration: "Refrigeration", ice_machine: "Ice machine", kitchen_equipment: "Kitchen equipment", exhaust_hood: "Hood/exhaust", multiple: "Multiple" };
const text = (v: unknown) => (typeof v === "string" ? v : Array.isArray(v) ? v.join(" ") : "");

export default async function CallListPage({ searchParams }: { searchParams: Promise<{ service?: string; trade?: string }> }) {
  const profile = await getCurrentStaffProfile();
  if (!profile || !["manager", "office", "salesperson"].includes(profile.role)) redirect("/");
  const { service, trade: tradeParam } = await searchParams;
  const trade = isTrade(tradeParam) ? tradeParam : null;

  const client = createServiceRoleClient();
  let query = client.from("chillbros_revenue_prospects")
    .select("id,business_name,city,score,service_line,category,contact_phone,contact_email,email_subject,assigned_salesperson")
    .eq("sales_status", "ready_to_call").eq("do_not_contact", false)
    .order("score", { ascending: false }).limit(1000);
  if (service && SERVICE[service]) query = query.eq("service_line", service);
  if (trade) query = query.contains("trade_fits", [trade]);
  if (profile.role === "office") query = query.eq("assigned_salesperson", profile.id);
  const { data, error } = await query;
  const rows = (data ?? []) as Row[];

  const cards = new Map<string, Card["content"]>();
  for (let i = 0; i < rows.length; i += 200) {
    const { data: c } = await client.from("chillbros_revenue_battle_cards").select("lead_id,content").eq("is_current", true).in("lead_id", rows.slice(i, i + 200).map((r) => r.id));
    for (const card of (c ?? []) as Card[]) cards.set(card.lead_id, card.content);
  }
  const fitOf = (id: string) => Number(cards.get(id)?.fit?.score) || 0;
  rows.sort((a, b) => fitOf(b.id) - fitOf(a.id) || b.score - a.score);

  return <AppShell title="Call List" description="Ready-to-call leads, best fit first. Tap a business for its full card.">
    <div className="mx-auto max-w-3xl space-y-4 text-left">
      {error ? <p className="rounded-xl border border-amber-400 p-3 text-amber-200">Call list could not load. {error.message}</p> : null}
      <section className="rounded-2xl border border-cyan-300/30 bg-cyan-400/5 p-4">
        <p className="text-2xl font-bold text-white">{rows.length} ready to call</p>
        <p className="mt-1 text-sm text-zinc-300">Each one has a call script, questions, objection answers, a plan to pitch and an email draft. Log the call on its card when you&apos;re done.</p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <Link href="/revenue-radar/call-list" className={`rounded-full border px-3 py-1.5 ${!service ? "border-cyan-300 text-cyan-100" : "border-white/15 text-zinc-300"}`}>All</Link>
          {Object.entries(SERVICE).map(([k, label]) => <Link key={k} href={`/revenue-radar/call-list?service=${k}`} className={`rounded-full border px-3 py-1.5 ${service === k ? "border-cyan-300 text-cyan-100" : "border-white/15 text-zinc-300"}`}>{label}</Link>)}
        </div>
        <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-zinc-400">Leads for buyer trade</p>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          {Object.entries(TRADES).map(([k, label]) => <Link key={k} href={`/revenue-radar/call-list?trade=${k}`} className={`rounded-full border px-3 py-1.5 ${trade === k ? "border-amber-300 text-amber-100" : "border-white/15 text-zinc-300"}`}>{label}</Link>)}
        </div>
      </section>

      <ol className="space-y-3">
        {rows.map((r, i) => {
          const card = cards.get(r.id);
          const opener = trade ? tradeOpener(trade, r) : text(card?.callOpener);
          const phone = r.contact_phone?.replace(/[^\d+]/g, "");
          return <li key={r.id} className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-zinc-500">#{i + 1} · {r.city} · {SERVICE[r.service_line] ?? r.service_line}</p>
                <Link href={`/revenue-radar/${r.id}`} className="mt-0.5 block truncate text-lg font-semibold text-white underline decoration-cyan-300/30 underline-offset-4">{r.business_name}</Link>
              </div>
              <div className="shrink-0 text-right">
                {card?.fit?.score ? <p className="text-lg font-bold text-cyan-200">{card.fit.score}/10</p> : <p className="text-xs text-zinc-500">Score {r.score}</p>}
                {card?.suggestedPlan?.tier ? <p className="text-xs text-zinc-400">{card.suggestedPlan.tier}</p> : null}
              </div>
            </div>
            {opener ? <p className="mt-2 line-clamp-3 text-sm text-zinc-300">&ldquo;{opener}&rdquo;</p> : null}
            <div className="mt-3 flex flex-wrap gap-2 text-sm">
              {phone ? <a href={`tel:${phone}`} className="min-h-11 rounded-xl border border-emerald-300/40 bg-emerald-400/10 px-4 py-2.5 font-semibold text-emerald-100">Call {r.contact_phone}</a> : null}
              {r.contact_email ? <a href={`mailto:${r.contact_email}`} className="min-h-11 rounded-xl border border-white/15 px-4 py-2.5 text-zinc-200">Email</a> : null}
              <Link href={`/revenue-radar/${r.id}`} className="min-h-11 rounded-xl border border-cyan-300/40 px-4 py-2.5 text-cyan-100">Open card →</Link>
            </div>
          </li>;
        })}
      </ol>
      {!rows.length && !error ? <p className="text-zinc-400">No leads are ready yet. Sales Prep adds more every 10 minutes.</p> : null}
    </div>
  </AppShell>;
}
