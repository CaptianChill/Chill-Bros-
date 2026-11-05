import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { BuyerChecklist } from "@/components/leadbiz/buyer-checklist";
import { loadBuyerList } from "@/lib/chillbros/leadbiz/buyer-list";
import { BUYER_SCRIPTS, BUYER_TRADES } from "@/lib/chillbros/leadbiz/buyer-scripts";
import { PAY_LINKS } from "@/lib/chillbros/leadbiz/buyers";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import { createServiceRoleClient } from "@/lib/supabase/service-client";

export const dynamic = "force-dynamic";

// Lead Buyers: licensed SA-area contractors to sell lead packs to, with call results and PDFs.
export default async function LeadBuyersPage() {
  const profile = await getCurrentStaffProfile();
  if (profile?.role !== "manager") redirect("/revenue-radar");
  let rows: Awaited<ReturnType<typeof loadBuyerList>> = [];
  let error = "";
  try { rows = await loadBuyerList(createServiceRoleClient()); } catch (e) { error = e instanceof Error ? e.message : "List unavailable"; }
  const pdf = (kind: string, trade?: string) => `/revenue-radar/buyers/pdf?kind=${kind}${trade ? `&trade=${encodeURIComponent(trade)}` : ""}`;

  return <AppShell title="Lead Buyers" description="Licensed San Antonio-area contractors to sell San Antonio New Openings lead packs to.">
    <div className="mx-auto max-w-5xl space-y-4 text-left">
      {error ? <p className="rounded-xl border border-amber-400 p-3 text-amber-200">Lead Buyers list is not ready. {error}</p> : null}
      {!error && !rows.length ? <p className="rounded-xl border border-cyan-300/40 p-3 text-cyan-100">The state license lists load automatically within the hour. Check back shortly.</p> : null}
      <section className="rounded-2xl border border-white/10 bg-black/30 p-4">
        <h2 className="font-semibold text-white">Documents</h2>
        <p className="mt-1 text-sm text-zinc-400">Always the current list, with your saved results. Printable has boxes to tick by pen; Fillable has real checkboxes and a notes field on every row.</p>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <a className="rounded-xl border border-cyan-300/50 px-4 py-2.5 font-semibold text-cyan-100" href={pdf("print")}>🖨️ Printable PDF (all)</a>
          <a className="rounded-xl border border-emerald-300/50 px-4 py-2.5 font-semibold text-emerald-100" href={pdf("fill")}>☑️ Fillable PDF (all)</a>
          {BUYER_TRADES.map((t) => <a key={t} className="rounded-xl border border-white/15 px-3 py-2.5 text-zinc-200" href={pdf("print", t)}>{t} only</a>)}
          <a className="rounded-xl border border-[#F5C542]/50 px-3 py-2.5 text-[#F5C542]" href={PAY_LINKS.bundle} target="_blank">Bundle link to text ↗</a>
        </div>
      </section>
      <BuyerChecklist rows={rows} scripts={BUYER_SCRIPTS} />
      <p className="text-xs text-zinc-500">Sources: TDLR (electricians, sign companies), Texas State Board of Plumbing Examiners (plumbers), Texas Department of Agriculture (pest control; no phones in that file). Bexar, Comal, Guadalupe, Kendall, Medina and Wilson counties, refreshed daily. Call by hand: no auto-dialers or mass texts.</p>
    </div>
  </AppShell>;
}
