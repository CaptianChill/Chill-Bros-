import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { SectionCard } from "@/components/section-card";
import { LEGACY_PAY_LINKS, TRADE_LABEL } from "@/lib/chillbros/leadbiz/buyers";
import { MAX_BUYERS_PER_TRADE, SLUG_TRADE } from "@/lib/chillbros/leadbiz/catalog";

import { revokeLeadPackOrder, writeCardsWithClaude } from "./actions";
import { claudeConfigured, CLAUDE_MODEL } from "@/lib/chillbros/claude";
import { needsProjectAi, type ProjectFacts } from "@/lib/chillbros/leadbiz/project-ai";
import { CLAUDE_OFF } from "@/lib/chillbros/leadbiz/project-ai-runner";
import { getOwnerProfile } from "@/lib/chillbros/sent-invoice-history";
import { TRADES, type Trade } from "@/lib/chillbros/trade-fit";
import { createServiceRoleClient } from "@/lib/supabase/service-client";

export const dynamic = "force-dynamic";
// Claude writes lead-pack cards from the owner's button; give it room.
export const maxDuration = 300;

type Buyer = { business_name: string; trade: Trade; email: string | null; status: string; emailed_at: string | null; followup_at: string | null; last_error: string | null };
type Run = { ran_at: string; result: Record<string, unknown> };
type Usage = { trade: string; projects_total: number; projects_open: number; projects_full: number; buyers: number };
type Order = { id: string; square_ref: string; product: string; trade: string | null; buyer_email: string; buyer_name: string | null; amount_cents: number | null; status: string; note: string | null; projects_owed: number; projects_delivered: number; created_at: string; first_opened_at: string | null; open_count: number };
type ProductRow = { key: string; name: string; kind: string; price_cents: number; projects: number; contacts: number; on_sale: boolean; square_link: string | null };

const when = (v: string | null) => (v ? new Date(v).toLocaleString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—");

function windows() {
  const now = Date.now();
  return { dayAgo: new Date(now - 86400000).toISOString(), weekAgo: new Date(now - 7 * 86400000).toISOString() };
}

// Owner view of the lead business: contractor outreach pipeline, last runs, and the sales links.
export default async function LeadBusinessPage({ searchParams }: { searchParams: Promise<{ claude?: string; ok?: string }> }) {
  if (!(await getOwnerProfile())) redirect("/");
  const { claude: claudeNote, ok: claudeOk } = await searchParams;
  const db = createServiceRoleClient();
  const { dayAgo, weekAgo } = windows();
  const [{ data: buyers }, { data: runs }, ready, unsubs, { data: usage }, { data: orders }, { data: products }, { data: cards }] = await Promise.all([
    db.from("chillbros_leadbiz_buyers").select("business_name,trade,email,status,emailed_at,followup_at,last_error").order("emailed_at", { ascending: false, nullsFirst: false }).limit(2000),
    db.from("chillbros_leadbiz_runs").select("ran_at,result").order("id", { ascending: false }).limit(6),
    db.from("chillbros_revenue_prospects").select("id", { count: "exact", head: true }).eq("sales_status", "ready_to_call").eq("do_not_contact", false),
    db.from("chillbros_outreach_suppressions").select("contact", { count: "exact", head: true }),
    db.rpc("chillbros_leadpack_trade_usage"),
    db.from("chillbros_leadpack_orders").select("id,square_ref,product,trade,buyer_email,buyer_name,amount_cents,status,note,projects_owed,projects_delivered,created_at,first_opened_at,open_count").order("created_at", { ascending: false }).limit(100),
    db.from("chillbros_leadpack_products").select("key,name,kind,price_cents,projects,contacts,on_sale,square_link").order("sort"),
    db.from("chillbros_leadpack_projects").select("key,industry,title,data").eq("active", true),
  ]);
  const cardRows = (cards ?? []) as ProjectFacts[];
  const cardsWithClaude = cardRows.filter((c) => !needsProjectAi(c)).length;
  const claudeOn = claudeConfigured();
  const usageRows = (usage ?? []) as Usage[];
  const orderRows = (orders ?? []) as Order[];
  const productRows = (products ?? []) as ProductRow[];
  const tradeName = (slug: string | null) => (slug && SLUG_TRADE[slug] ? TRADE_LABEL[SLUG_TRADE[slug]].plural : slug ?? "no trade");
  const list = (buyers ?? []) as Buyer[];
  const sentDay = list.filter((b) => (b.emailed_at && b.emailed_at >= dayAgo) || (b.followup_at && b.followup_at >= dayAgo)).length;
  const sentWeek = list.filter((b) => b.emailed_at && b.emailed_at >= weekAgo).length;
  const withEmail = list.filter((b) => b.email).length;
  const queued = list.filter((b) => b.status === "ready").length;
  const errors = list.filter((b) => b.last_error).length;
  const byTrade = (Object.keys(TRADES) as Trade[]).map((t) => {
    const rows = list.filter((b) => b.trade === t);
    return { t, found: rows.length, email: rows.filter((b) => b.email).length, sent: rows.filter((b) => b.emailed_at).length };
  });
  const lastRun = (runs ?? [])[0] as Run | undefined;

  const stat = (label: string, value: string | number) => (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-4"><p className="text-xs uppercase tracking-wide text-zinc-400">{label}</p><p className="mt-1 text-2xl font-bold text-white">{value}</p></div>
  );

  return <AppShell title="Lead Business" description="San Antonio New Openings: contractor outreach and lead-pack sales.">
    <div className="mx-auto max-w-4xl space-y-5 text-left">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stat("Emails sent (24h)", sentDay)}
        {stat("Emails sent (7 days)", sentWeek)}
        {stat("Contractors with email", `${withEmail} / ${list.length}`)}
        {stat("Waiting to send", queued)}
        {stat("Ready-to-call leads", ready.count ?? 0)}
        {stat("Unsubscribed (all mail)", unsubs.count ?? 0)}
        {stat("Send errors", errors)}
        {stat("Last run", lastRun ? when(lastRun.ran_at) : "—")}
      </div>

      {lastRun ? <p className="rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-zinc-300">Last run: {String(lastRun.result.note ?? `found ${lastRun.result.discovered ?? 0}, emails ${lastRun.result.sent ?? 0}, follow-ups ${lastRun.result.followedUp ?? 0}`)}</p> : null}

      <SectionCard title="Lead pack lineup" description="Buy buttons go through the capacity check first. A product without a Square link shows “opening soon” to buyers.">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-zinc-400"><tr><th className="py-2">Product</th><th>Price</th><th>Projects</th><th>Square link</th></tr></thead>
          <tbody>{productRows.filter((p) => p.kind !== "legacy").map((p) => <tr key={p.key} className="border-t border-white/10">
            <td className="py-2 text-white">{p.name}</td>
            <td>${(p.price_cents / 100).toFixed(0)}{p.kind === "subscription" ? "/mo" : ""}</td>
            <td>{p.projects}{p.contacts ? ` + ${p.contacts} contacts` : ""}{p.kind === "subscription" ? " / month" : ""}</td>
            <td>{p.square_link && p.on_sale ? <a className="text-cyan-200 underline" href={p.square_link} target="_blank">live ↗</a> : <span className="text-amber-200">needs link</span>}</td>
          </tr>)}</tbody>
        </table>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <a className="rounded-xl border border-cyan-300/40 px-4 py-2.5 text-cyan-100" href="/new-openings" target="_blank">Public sales page ↗</a>
          <a className="rounded-xl border border-white/15 px-4 py-2.5 text-zinc-200" href="https://app.squareup.com/dashboard/sales/transactions" target="_blank">Sales in Square ↗</a>
          <Link className="rounded-xl border border-white/15 px-4 py-2.5 text-zinc-200" href="/revenue-radar/call-list">Call List by trade</Link>
        </div>
        <details className="mt-3 text-sm text-zinc-400">
          <summary className="cursor-pointer">Old v1 Square links: turn these off in Square</summary>
          <ul className="mt-2 space-y-1">{Object.entries(LEGACY_PAY_LINKS).map(([k, u]) => <li key={k}>{k}: <a className="underline" href={u} target="_blank">{u}</a></li>)}</ul>
          <p className="mt-2">If one is paid anyway the delivery still works and is recorded; the $449 Exclusive is auto-flagged for refund.</p>
        </details>
      </SectionCard>

      <div id="claude" />
      <SectionCard title="Claude card writer" description="Claude writes, for every trade a card is sold to, why the job fits that trade, a call opener and a short email opener. It only uses the card's own facts; contact, phone, project and timing never change. Buyers see Claude's copy on their delivery page and spreadsheet; cards without it keep the standard opener.">
        {!claudeOn ? <p className="rounded-xl border border-amber-300/40 bg-amber-400/10 p-3 text-sm text-amber-100">{CLAUDE_OFF}</p> : null}
        {claudeNote ? <p className={`mb-3 rounded-xl border p-3 text-sm ${claudeOk === "1" ? "border-emerald-300/40 bg-emerald-400/10 text-emerald-100" : "border-amber-300/40 bg-amber-400/10 text-amber-100"}`}>{claudeNote}</p> : null}
        <p className="text-sm text-zinc-300">{cardsWithClaude} of {cardRows.length} active cards have Claude copy{claudeOn ? ` · model ${CLAUDE_MODEL}` : ""}.</p>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <form action={writeCardsWithClaude}><button disabled={!claudeOn} className="rounded-xl border border-cyan-300/40 px-4 py-2.5 text-cyan-100 disabled:opacity-40">Write missing cards with Claude</button></form>
          <form action={writeCardsWithClaude}><input type="hidden" name="redo" value="1" /><button disabled={!claudeOn} className="rounded-xl border border-white/15 px-4 py-2.5 text-zinc-200 disabled:opacity-40">Rewrite all</button></form>
        </div>
        <p className="mt-2 text-xs text-zinc-500">About 10–20 seconds per card, three at a time. A long list may need a second tap.</p>
      </SectionCard>

      <SectionCard title="Projects left per trade" description={`Each project can go to ${MAX_BUYERS_PER_TRADE} buyers per trade. "Full" means all ${MAX_BUYERS_PER_TRADE} slots are taken.`}>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-zinc-400"><tr><th className="py-2">Trade</th><th>Buyers</th><th>Open</th><th>Full</th><th>Total</th></tr></thead>
          <tbody>{usageRows.map((u) => <tr key={u.trade} className="border-t border-white/10"><td className="py-2 capitalize text-white">{tradeName(u.trade)}</td><td>{u.buyers}</td><td className={u.projects_open < 5 ? "text-amber-200" : ""}>{u.projects_open}</td><td>{u.projects_full}</td><td>{u.projects_total}</td></tr>)}</tbody>
        </table>
      </SectionCard>

      <SectionCard title="Lead pack orders" description="Every delivery is recorded here. Revoke turns the buyer's link off and frees their project slots (use after a refund or if a pack was shared).">
        {orderRows.length ? <ul className="divide-y divide-white/10 text-sm">
          {orderRows.map((o) => <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-white">{o.buyer_name ?? o.buyer_email} <span className="text-zinc-500">· {o.product} · {tradeName(o.trade)}</span></p>
              <p className="text-xs text-zinc-400">{when(o.created_at)} · {o.square_ref} · {o.projects_delivered}/{o.projects_owed} projects · opened {o.open_count}×{o.note ? ` · ${o.note}` : ""}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-xs ${o.status === "delivered" ? "bg-emerald-400/15 text-emerald-200" : o.status === "revoked" ? "bg-zinc-500/20 text-zinc-300" : "bg-amber-400/15 text-amber-200"}`}>{o.status.replace("_", " ")}</span>
              {o.status === "delivered" ? <form action={revokeLeadPackOrder}><input type="hidden" name="id" value={o.id} /><button className="rounded-lg border border-red-300/40 px-2.5 py-1 text-xs text-red-200">Revoke</button></form> : null}
            </div>
          </li>)}
        </ul> : <p className="text-sm text-zinc-400">No lead pack orders yet.</p>}
      </SectionCard>

      <SectionCard title="Contractors by trade">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-zinc-400"><tr><th className="py-2">Trade</th><th>Found</th><th>With email</th><th>Emailed</th></tr></thead>
          <tbody>{byTrade.map((r) => <tr key={r.t} className="border-t border-white/10"><td className="py-2 capitalize text-white">{TRADE_LABEL[r.t].plural}</td><td>{r.found}</td><td>{r.email}</td><td>{r.sent}</td></tr>)}</tbody>
        </table>
      </SectionCard>

      <SectionCard title="Recently emailed">
        {list.filter((b) => b.emailed_at).length ? <ul className="divide-y divide-white/10 text-sm">
          {list.filter((b) => b.emailed_at).slice(0, 25).map((b) => <li key={`${b.business_name}${b.emailed_at}`} className="flex justify-between gap-3 py-2"><span className="truncate text-white">{b.business_name} <span className="text-zinc-500">· {TRADE_LABEL[b.trade].plural}</span></span><span className="shrink-0 text-zinc-400">{b.status === "followed_up" ? "followed up" : when(b.emailed_at)}</span></li>)}
        </ul> : <p className="text-sm text-zinc-400">No outreach emails yet. They send every day 9am–5pm once contractors with emails are found.</p>}
      </SectionCard>
    </div>
  </AppShell>;
}
