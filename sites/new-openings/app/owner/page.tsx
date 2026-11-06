import { redirect } from "next/navigation";
import { isOwner } from "@/lib/auth";
import { BRAND, PACKS } from "@/lib/brand";
import { ownerDashboard } from "@/lib/db";

export const dynamic = "force-dynamic";

const TRADE_NAMES: Record<string, string> = { plumbing: "Plumbers", electrical: "Electricians", hood_cleaning: "Hood cleaners", pest_control: "Pest control", commercial_cleaning: "Commercial cleaning", signs: "Sign companies", low_voltage: "Low voltage", security: "Security", hvac_refrigeration: "HVAC & refrigeration", kitchen_equipment: "Kitchen equipment" };
const when = (v: string | null) => (v ? new Date(v).toLocaleString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—");
function windows() { const now = Date.now(); return { dayAgo: new Date(now - 86400000).toISOString(), weekAgo: new Date(now - 7 * 86400000).toISOString() }; }

export default async function OwnerPage() {
  if (!(await isOwner())) redirect("/owner/login");
  const data = await ownerDashboard();
  const { dayAgo, weekAgo } = windows();
  const list = data?.buyers ?? [];
  const sentDay = list.filter((b) => (b.emailed_at && b.emailed_at >= dayAgo) || (b.followup_at && b.followup_at >= dayAgo)).length;
  const sentWeek = list.filter((b) => b.emailed_at && b.emailed_at >= weekAgo).length;
  const lastRun = data?.runs?.[0];
  const stat = (label: string, value: string | number) => <div className="rounded-2xl border border-white/10 bg-black/30 p-4"><p className="text-xs uppercase tracking-wide text-[#8A9BB0]">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p></div>;
  const emailed = list.filter((b) => b.emailed_at);

  return (
    <main className="mx-auto max-w-4xl space-y-5 px-4 py-8">
      <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#7FD4FF]">{BRAND.name}</p><h1 className="text-3xl font-bold uppercase">Owner dashboard</h1></div>
      {!data ? <p className="rounded-xl border border-[#FF7A59]/50 p-3 text-[#FF7A59]">Database not reachable. Check SUPABASE_URL, SUPABASE_ANON_KEY and LEADBIZ_DB_KEY in this site&apos;s settings.</p> : null}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stat("Emails sent (24h)", sentDay)}
        {stat("Emails sent (7 days)", sentWeek)}
        {stat("Contractors with email", `${list.filter((b) => b.email).length} / ${list.length}`)}
        {stat("Waiting to send", list.filter((b) => b.status === "ready").length)}
        {stat("Ready-to-call leads", data?.ready ?? 0)}
        {stat("Unsubscribed", data?.unsubscribed ?? 0)}
        {stat("Send errors", list.filter((b) => b.last_error).length)}
        {stat("Last run", lastRun ? when(lastRun.ran_at) : "—")}
      </div>
      {lastRun ? <p className="rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-[#C9D6E3]">Last run: {String(lastRun.result.note ?? `found ${lastRun.result.discovered ?? 0}, emails ${lastRun.result.sent ?? 0}, follow-ups ${lastRun.result.followedUp ?? 0}`)}</p> : null}

      <section className="rounded-2xl border border-white/10 bg-black/30 p-4">
        <h2 className="font-bold uppercase">Sales links</h2>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <a className="rounded-xl border border-[#7FD4FF]/40 px-4 py-2.5 text-[#7FD4FF]" href="/" target="_blank">Public sales page ↗</a>
          {PACKS.map((p) => <a key={p.key} className="rounded-xl border border-white/15 px-4 py-2.5" href={p.href} target="_blank">{p.name.split(" ")[0]} {p.price}</a>)}
          <a className="rounded-xl border border-[#F5C542]/60 px-4 py-2.5 font-semibold text-[#F5C542]" href="/owner/call-list">Buyer call list</a>
          <a className="rounded-xl border border-white/15 px-4 py-2.5" href="https://app.squareup.com/dashboard/sales/transactions" target="_blank">Sales in Square ↗</a>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-black/30 p-4">
        <h2 className="font-bold uppercase">Contractors by trade</h2>
        <table className="mt-3 w-full text-sm">
          <thead className="text-left text-xs uppercase text-[#8A9BB0]"><tr><th className="py-2">Trade</th><th>Found</th><th>With email</th><th>Emailed</th></tr></thead>
          <tbody>{Object.entries(TRADE_NAMES).map(([k, label]) => { const r = list.filter((b) => b.trade === k); return <tr key={k} className="border-t border-white/10"><td className="py-2">{label}</td><td>{r.length}</td><td>{r.filter((b) => b.email).length}</td><td>{r.filter((b) => b.emailed_at).length}</td></tr>; })}</tbody>
        </table>
      </section>

      <section className="rounded-2xl border border-white/10 bg-black/30 p-4">
        <h2 className="font-bold uppercase">Recently emailed</h2>
        {emailed.length ? <ul className="mt-3 divide-y divide-white/10 text-sm">{emailed.slice(0, 25).map((b) => <li key={`${b.business_name}${b.emailed_at}`} className="flex justify-between gap-3 py-2"><span className="truncate">{b.business_name} <span className="text-[#8A9BB0]">· {TRADE_NAMES[b.trade] ?? b.trade}</span></span><span className="shrink-0 text-[#8A9BB0]">{b.status === "followed_up" ? "followed up" : when(b.emailed_at)}</span></li>)}</ul>
          : <p className="mt-2 text-sm text-[#8A9BB0]">No outreach emails yet. They send weekdays 9am–3pm once contractors with emails are found.</p>}
      </section>
    </main>
  );
}
