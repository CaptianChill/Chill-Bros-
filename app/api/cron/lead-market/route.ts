import { marketDb } from "@/lib/lead-market/store";
import { marketPaymentsConfigured, reconcileMarketOrder } from "@/lib/lead-market/commerce";
import { runBuyerOutreach } from "@/lib/lead-market/mailbox";
export const maxDuration = 300;
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  const db = marketDb(); let reconciled = 0; let errors = 0;
  if (marketPaymentsConfigured()) {
    const { data: orders, error } = await db.from("chillbros_market_orders").select("id,buyer_id").in("status", ["pending_payment", "cancelled", "refund_pending"]).not("square_order_id", "is", null).order("checked_at", { nullsFirst: true }).order("id").limit(10);
    if (error) return Response.json({ ok: false, error: "Payment queue unavailable" }, { status: 503 });
    for (const o of orders ?? []) {
      try { await reconcileMarketOrder(o.id, o.buyer_id); reconciled++; } catch { errors++; }
      await db.from("chillbros_market_orders").update({ checked_at: new Date().toISOString() }).eq("id", o.id);
    }
  }
  try { const outreach = await runBuyerOutreach(10); return Response.json({ ok: errors === 0, reconciled, errors, outreach }); }
  catch { return Response.json({ ok: false, reconciled, errors, error: "Outreach stopped safely; inspect retained reservations" }, { status: 503 }); }
}
