import { buildBuyerSheet } from "@/lib/chillbros/leadbiz/buyer-pdf";
import { loadBuyerList } from "@/lib/chillbros/leadbiz/buyer-list";
import { BUYER_SCRIPTS, BUYER_TRADES, RESULT_LABEL } from "@/lib/chillbros/leadbiz/buyer-scripts";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import { createServiceRoleClient } from "@/lib/supabase/service-client";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const profile = await getCurrentStaffProfile();
  if (profile?.role !== "manager") return new Response("Not allowed", { status: 403 });
  const url = new URL(request.url);
  const kind = url.searchParams.get("kind") === "fill" ? "fill" : "print";
  const trade = BUYER_TRADES.find((t) => t === url.searchParams.get("trade"));
  const rows = await loadBuyerList(createServiceRoleClient(), trade);
  const order = (t: string) => { const i = BUYER_TRADES.indexOf(t); return i < 0 ? 99 : i; };
  rows.sort((a, b) => order(a.trade) - order(b.trade) || a.name.localeCompare(b.name));
  const date = new Date().toLocaleDateString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", year: "numeric" });
  const bytes = await buildBuyerSheet(
    rows.map((r) => ({ ...r, done: Boolean(r.status), result: [r.status ? RESULT_LABEL[r.status] : "", r.note].filter(Boolean).join(" - ") || null })),
    kind,
    { title: `San Antonio New Openings - Lead Buyer Call Sheet${trade ? `: ${trade}` : ""}`, subtitle: `${rows.length} licensed contractors · Texas state license records · ${date} · Chill Professionals LLC (210) 904-9306`, script: BUYER_SCRIPTS },
  );
  const name = `Lead_Buyers_${trade ? trade.replace(/\s+/g, "_") + "_" : ""}${kind === "fill" ? "Fillable" : "Printable"}.pdf`;
  return new Response(Buffer.from(bytes), { headers: { "content-type": "application/pdf", "content-disposition": `inline; filename="${name}"`, "cache-control": "private, no-store" } });
}
