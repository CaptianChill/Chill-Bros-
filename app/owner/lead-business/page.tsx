import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { SectionCard } from "@/components/section-card";
import { PAY_LINKS, TRADE_LABEL } from "@/lib/chillbros/leadbiz/buyers";
import { getOwnerProfile } from "@/lib/chillbros/sent-invoice-history";
import { TRADES, type Trade } from "@/lib/chillbros/trade-fit";
import { createServiceRoleClient } from "@/lib/supabase/service-client";

export const dynamic = "force-dynamic";

type Buyer = { business_name: string; trade: Trade; email: string | null; status: string; emailed_at: string | null; followup_at: string | null; last_error: string | null };
type Run = { ran_at: string; result: Record<string, unknown> };

const when = (v: string | null) => (v ? new Date(v).toLocaleString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—");

function windows() {
  const now = Date.now();
  return { dayAgo: new Date(now - 86400000).toISOString(), weekAgo: new Date(now - 7 * 86400000).toISOString() };
}

// Owner view of the lead business: contractor outreach pipeline, last runs, and the sales links.
export default async function LeadBusinessPage() {
  if (!(await getOwnerProfile())) redirect("/");
  const db = createServiceRoleClient();
  const { dayAgo, weekAgo } = windows();
  const [{ data: buyers }, { data: runs }, ready, unsubs] = await Promise.all([
    db.from("chillbros_leadbiz_buyers").select("business_name,trade,email,status,emailed_at,followup_at,last_error").order("emailed_at", { ascending: false, nullsFirst: false }).limit(2000),
    db.from("chillbros_leadbiz_runs").select("ran_at,result").order("id", { ascending: false }).limit(6),
    db.from("chillbros_revenue_prospects").select("id", { count: "exact", head: true }).eq("sales_status", "ready_to_call").eq("do_not_contact", false),
    db.from("chillbros_outreach_suppressions").select("contact", { count: "exact", head: true }),
  ]);
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

      <SectionCard title="Sales links">
        <div className="flex flex-wrap gap-2 text-sm">
          <a className="rounded-xl border border-cyan-300/40 px-4 py-2.5 text-cyan-100" href="/new-openings" target="_blank">Public sales page ↗</a>
          <a className="rounded-xl border border-white/15 px-4 py-2.5 text-zinc-200" href={PAY_LINKS.bundle} target="_blank">Bundle $199</a>
          <a className="rounded-xl border border-white/15 px-4 py-2.5 text-zinc-200" href={PAY_LINKS.openings} target="_blank">Openings $150</a>
          <a className="rounded-xl border border-white/15 px-4 py-2.5 text-zinc-200" href={PAY_LINKS.starter} target="_blank">Starter $75</a>
          <a className="rounded-xl border border-white/15 px-4 py-2.5 text-zinc-200" href={PAY_LINKS.food} target="_blank">Restaurant & Retail $99</a>
          <a className="rounded-xl border border-white/15 px-4 py-2.5 text-zinc-200" href={PAY_LINKS.auto} target="_blank">Auto $99</a>
          <a className="rounded-xl border border-amber-300/40 px-4 py-2.5 text-amber-100" href={PAY_LINKS.exclusive} target="_blank">Exclusive $449</a>
          <a className="rounded-xl border border-white/15 px-4 py-2.5 text-zinc-200" href="https://app.squareup.com/dashboard/sales/transactions" target="_blank">Sales in Square ↗</a>
          <Link className="rounded-xl border border-white/15 px-4 py-2.5 text-zinc-200" href="/revenue-radar/call-list">Call List by trade</Link>
        </div>
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
        </ul> : <p className="text-sm text-zinc-400">No outreach emails yet. They send weekdays 9am–3pm once contractors with emails are found.</p>}
      </SectionCard>
    </div>
  </AppShell>;
}
