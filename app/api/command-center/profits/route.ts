import { getCurrentStaffProfile, OWNER_EMAIL } from "@/lib/supabase/auth-server";
import { getInvoiceCenterData } from "@/lib/chillbros/billing-queries";
import { createServiceRoleClient } from "@/lib/supabase/service-client";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "private, no-store, max-age=0" };
const round = (value: number) => Math.round(value * 100) / 100;

type AppMoney = { id: string; label: string; value: number | null; sub: string; state: "live" | "error" };

/** Chill Pros: money actually collected (paid invoices, minus refunds). */
async function chillPros(): Promise<AppMoney> {
  try {
    const { rows, metrics, loadError } = await getInvoiceCenterData();
    if (loadError) throw new Error(loadError);
    const allTime = rows.filter((row) => row.paymentStatus === "paid" && !row.convertedInvoiceId).reduce((sum, row) => sum + Math.max(0, row.total - row.refundAmount), 0);
    return { id: "crm", label: "Collected", value: round(allTime), sub: `$${round(metrics.collectedThisMonth).toLocaleString("en-US")} this month`, state: "live" };
  } catch (error) {
    console.error("[command-center] chill pros money failed", error);
    return { id: "crm", label: "Collected", value: null, sub: "Couldn't load", state: "error" };
  }
}

/** BBB: Autopilot pot profit since the pot clock started (settled, placed entries only). */
async function bbb(): Promise<AppMoney> {
  try {
    const s = createServiceRoleClient();
    const { data: settings, error: settingsError } = await s.from("autopilot_settings").select("pot_start,pot_started_at").eq("id", "owner").maybeSingle();
    if (settingsError) throw settingsError;
    let query = s.from("autopilot_entries").select("profit,settled_at").eq("status", "placed").not("settled_at", "is", null).limit(5000);
    if (settings?.pot_started_at) query = query.gte("placed_at", settings.pot_started_at);
    const { data: entries, error } = await query;
    if (error) throw error;
    const weekAgo = Date.now() - 7 * 86_400_000;
    const total = (entries ?? []).reduce((sum, row) => sum + Number(row.profit ?? 0), 0);
    const week = (entries ?? []).filter((row) => Date.parse(String(row.settled_at)) >= weekAgo).reduce((sum, row) => sum + Number(row.profit ?? 0), 0);
    const pot = Number(settings?.pot_start ?? 0) + total;
    return { id: "bbb", label: "Profit", value: round(total), sub: `${week >= 0 ? "+" : "-"}$${Math.abs(round(week)).toLocaleString("en-US")} this week · pot $${round(pot).toLocaleString("en-US")}`, state: "live" };
  } catch (error) {
    console.error("[command-center] bbb money failed", error);
    return { id: "bbb", label: "Profit", value: null, sub: "Couldn't load", state: "error" };
  }
}

/**
 * GET /api/command-center/profits — owner-only money totals for the BB Command Center tiles.
 * Real figures only; apps with no money feed are simply not listed.
 */
export async function GET() {
  const profile = await getCurrentStaffProfile();
  if (!profile || profile.email.toLowerCase() !== OWNER_EMAIL) {
    return Response.json({ ok: false, error: "Owner sign-in required" }, { status: 401, headers: noStore });
  }
  const apps = await Promise.all([chillPros(), bbb()]);
  return Response.json({ ok: true, at: new Date().toISOString(), apps }, { headers: noStore });
}
