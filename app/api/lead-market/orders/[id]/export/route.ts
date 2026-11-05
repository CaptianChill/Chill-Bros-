import { currentBuyer, buyerOrder, deliveredLead, marketDb } from "@/lib/lead-market/store";
import { leadCsv } from "@/lib/lead-market/rules";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const buyer = await currentBuyer(); if (!buyer || buyer.status !== "active") return new Response("Buyer sign-in required", { status: 401 });
  try {
    const { id } = await params; const order = await buyerOrder(id, buyer.id); const lead = await deliveredLead(order);
    if (!lead) return new Response("This order is not available for export", { status: 403 });
    const { error } = await marketDb().from("chillbros_market_events").insert({ buyer_id: buyer.id, order_id: id, event: "csv_exported" });
    if (error) return new Response("Could not record delivery receipt", { status: 503 });
    return new Response(leadCsv(lead), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="lead-${id}.csv"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch { return new Response("Lead not found or restrictions could not be checked", { status: 404 }); }
}
