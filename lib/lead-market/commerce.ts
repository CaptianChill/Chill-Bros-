import "server-only";
import { createHash } from "node:crypto";
import { marketDb, buyerOrder } from "./store";
import { marketBase as appBase } from "./config";

export const marketPaymentsConfigured = () => Boolean(process.env.SQUARE_ACCESS_TOKEN?.trim() && process.env.SQUARE_LOCATION_ID?.trim());
async function square(path: string, method = "GET", body?: unknown) {
  if (!marketPaymentsConfigured()) throw new Error("Card checkout is not configured.");
  const base = process.env.SQUARE_ENVIRONMENT === "sandbox" ? "https://connect.squareupsandbox.com" : "https://connect.squareup.com";
  const response = await fetch(base + path, { method, headers: { Authorization: `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`, "Square-Version": "2026-09-16", "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body), cache: "no-store", signal: AbortSignal.timeout(15000) });
  const data = await response.json();
  if (!response.ok) throw new Error("Payment provider could not complete this request. Try again or contact support.");
  return data;
}
export async function openMarketCheckout(orderId: string, buyerId: string) {
  const order = await buyerOrder(orderId, buyerId);
  if (order.status !== "pending_payment") throw new Error("This order is not awaiting payment.");
  if (order.checkout_url) return order.checkout_url;
  const db = marketDb();
  const { data: buyer, error } = await db.from("chillbros_market_buyers").select("email").eq("id", buyerId).single();
  if (error || !buyer) throw new Error("Buyer unavailable.");
  if (!marketPaymentsConfigured()) throw new Error("Card checkout is not configured.");
  const claim = await db.rpc("chillbros_market_claim_checkout", { order_input: orderId, buyer_input: buyerId });
  if (claim.error) throw new Error("Could not claim checkout safely.");
  if (!claim.data) {
    const latest = await buyerOrder(orderId, buyerId);
    if (latest.checkout_url) return latest.checkout_url;
    throw new Error("Checkout is being prepared or needs recovery. Refresh the order; contact support if it remains unavailable.");
  }
  let result;
  try { result = await square("/v2/online-checkout/payment-links", "POST", {
    idempotency_key: "lm-" + createHash("sha256").update(order.id).digest("hex").slice(0, 40),
    order: { location_id: process.env.SQUARE_LOCATION_ID, reference_id: order.id, metadata: { lead_market_order: order.id }, line_items: [
      { name: "Chill Pros researched business lead", quantity: "1", base_price_money: { amount: order.price_cents, currency: "USD" } },
      ...(order.tax_cents ? [{ name: "Applicable tax", quantity: "1", base_price_money: { amount: order.tax_cents, currency: "USD" } }] : []),
    ] },
    checkout_options: { redirect_url: `${appBase()}/leads/orders/${order.id}?payment=processing`, allow_tipping: false, ask_for_shipping_address: false },
    pre_populated_data: { buyer_email: buyer.email },
  }); } catch {
    await db.from("chillbros_market_orders").update({ checkout_state: "review" }).eq("id", order.id);
    throw new Error("Checkout creation needs review before retrying. No second payment link will be created automatically.");
  }
  const link = result.payment_link;
  if (!link?.url || !link?.order_id || !link?.id || !/^https:\/\//.test(link.url)) throw new Error("Checkout was not created. Contact support before retrying.");
  const saved = await db.from("chillbros_market_orders").update({ checkout_url: link.url, square_order_id: link.order_id, square_link_id: link.id, checkout_state: "ready" }).eq("id", order.id).eq("buyer_id", buyerId).eq("status", "pending_payment");
  if (saved.error) throw new Error("Checkout could not be saved. Contact support before retrying.");
  return link.url as string;
}
/** Never trust a browser's payment=success parameter; verify the payment with Square. */
export async function reconcileMarketOrder(orderId: string, buyerId: string) {
  const order = await buyerOrder(orderId, buyerId);
  const { data: refundState } = await marketDb().from("chillbros_market_orders").select("square_refund_id").eq("id", orderId).eq("buyer_id", buyerId).single();
  if (order.status === "refund_pending" && refundState?.square_refund_id) {
    const { refund } = await square(`/v2/refunds/${encodeURIComponent(refundState.square_refund_id)}`);
    if (refund?.payment_id !== order.square_payment_id || refund.amount_money?.amount !== order.total_cents || refund.amount_money.currency !== "USD") throw new Error("Refund identity mismatch.");
    const status = refund.status === "COMPLETED" ? "refunded" : ["REJECTED", "FAILED"].includes(refund.status) ? "refund_required" : "refund_pending";
    const r = await marketDb().from("chillbros_market_orders").update({ status }).eq("id", orderId).eq("buyer_id", buyerId);
    if (r.error) throw new Error("Refund could not be reconciled.");
    return status;
  }
  if (!order.square_order_id || !["pending_payment", "cancelled"].includes(order.status)) return order.status;
  const { order: providerOrder } = await square(`/v2/orders/${encodeURIComponent(order.square_order_id)}`);
  if (providerOrder?.reference_id !== order.id || providerOrder?.location_id !== process.env.SQUARE_LOCATION_ID) throw new Error("Payment order identity mismatch.");
  const paymentIds = (providerOrder.tenders ?? []).map((t: { payment_id?: string }) => t.payment_id).filter(Boolean) as string[];
  for (const id of paymentIds) {
    const { payment } = await square(`/v2/payments/${encodeURIComponent(id)}`);
    if (payment?.status !== "COMPLETED") continue;
    if (payment.order_id !== order.square_order_id || payment.location_id !== process.env.SQUARE_LOCATION_ID || payment.amount_money?.currency !== "USD" || payment.amount_money.amount !== order.total_cents || (payment.refunded_money?.amount ?? 0) > 0) throw new Error("Payment amount or identity needs review.");
    const { data, error } = await marketDb().rpc("chillbros_market_settle", { order_input: order.id, payment_input: payment.id, amount_input: payment.amount_money.amount });
    if (error) throw new Error("Payment was received but delivery needs support review.");
    return data as string;
  }
  return order.status;
}
/** Bounded recovery finds the already-created link; it never makes another charge/link. */
export async function recoverMarketCheckout(orderId: string) {
  const db = marketDb();
  const { data: o, error } = await db.from("chillbros_market_orders").select("id,buyer_id,status,checkout_url").eq("id", orderId).single();
  if (error || !o || o.status !== "pending_payment") throw new Error("Unpaid order not found.");
  if (o.checkout_url) return;
  const page = await square("/v2/online-checkout/payment-links?limit=25");
  for (const link of page.payment_links ?? []) {
    if (!link.order_id || !link.id || !link.url) continue;
    const { order } = await square(`/v2/orders/${encodeURIComponent(link.order_id)}`);
    if (order?.reference_id !== o.id || order.location_id !== process.env.SQUARE_LOCATION_ID) continue;
    const { error: saved } = await db.from("chillbros_market_orders").update({ checkout_url: link.url, square_order_id: link.order_id, square_link_id: link.id, checkout_state: "ready" }).eq("id", o.id).eq("status", "pending_payment");
    if (saved) throw new Error("Existing checkout could not be saved.");
    return;
  }
  throw new Error("No matching checkout found in the latest 25 links. Inspect Square directly before releasing or retrying this order.");
}
export async function cancelMarketOrder(orderId: string, buyerId: string) {
  await reconcileMarketOrder(orderId, buyerId);
  const order = await buyerOrder(orderId, buyerId);
  if (order.status !== "pending_payment") throw new Error("A paid order cannot be cancelled. Open a support claim.");
  if (!order.square_link_id && order.checkout_state !== "new") throw new Error("Checkout creation must be reconciled by support before releasing its reserved slot.");
  if (order.square_link_id) await square(`/v2/online-checkout/payment-links/${encodeURIComponent(order.square_link_id)}`, "DELETE");
  const { error } = await marketDb().from("chillbros_market_orders").update({ status: "cancelled" }).eq("id", order.id).eq("buyer_id", buyerId).eq("status", "pending_payment");
  if (error) throw new Error("Cancellation could not be saved.");
}
export async function refundMarketOrder(orderId: string) {
  const { data: order, error } = await marketDb().from("chillbros_market_orders").select("id,square_payment_id,total_cents,status").eq("id", orderId).single();
  if (error || !order?.square_payment_id || !["delivered", "refund_required", "refund_pending"].includes(order.status)) throw new Error("This order cannot be refunded.");
  const { refund } = await square("/v2/refunds", "POST", { idempotency_key: "lmr-" + createHash("sha256").update(order.id).digest("hex").slice(0, 40), payment_id: order.square_payment_id, amount_money: { amount: order.total_cents, currency: "USD" }, reason: "Lead quality or fulfillment claim" });
  if (!refund?.id || !["PENDING", "COMPLETED"].includes(refund.status)) throw new Error("Refund needs manual provider review.");
  const saved = await marketDb().from("chillbros_market_orders").update({ status: refund.status === "COMPLETED" ? "refunded" : "refund_pending", square_refund_id: refund.id }).eq("id", order.id);
  if (saved.error) throw new Error("Refund accepted; support must reconcile its status.");
}
