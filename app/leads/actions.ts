"use server";
import { revalidatePath } from "next/cache";
import { requestMarketCode, verifyMarketCode, marketSession, endMarketSession } from "@/lib/lead-market/auth";
import { currentBuyer, marketDb } from "@/lib/lead-market/store";
import { cleanText } from "@/lib/lead-market/rules";
import { cancelMarketOrder, openMarketCheckout, reconcileMarketOrder } from "@/lib/lead-market/commerce";
import type { MarketResult } from "@/components/lead-market/form";

const value = (f: FormData, key: string, max = 1000) => cleanText(f.get(key), max);
async function result(fn: () => Promise<Omit<MarketResult, "ok"> | void>): Promise<MarketResult> {
  try { const response = await fn(); revalidatePath("/leads", "layout"); return { ok: true, ...response }; }
  catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Could not complete this request." }; }
}
async function buyer() {
  const b = await currentBuyer();
  if (!b || b.status === "suspended") throw new Error("Sign in to an available buyer account first.");
  return b;
}
export async function requestBuyerCode(f: FormData) { return result(async () => { const email = await requestMarketCode(value(f, "email", 320)); return { redirect: `/leads/sign-in?email=${encodeURIComponent(email)}&code=1` }; }); }
export async function verifyBuyerCode(f: FormData) { return result(async () => { await verifyMarketCode(value(f, "email", 320), value(f, "code", 6)); return { redirect: (await currentBuyer()) ? "/leads/account" : "/leads/join" }; }); }
export async function signOutBuyer() { return result(async () => { await endMarketSession(); return { redirect: "/leads" }; }); }
export async function registerBuyer(f: FormData) { return result(async () => {
  const session = await marketSession(); if (!session) throw new Error("Sign in first.");
  if (f.get("terms") !== "on") throw new Error("Accept the buyer terms and privacy notice.");
  const { error } = await marketDb().rpc("chillbros_market_register", { account_input: session.accountId, email_input: session.email, company_input: value(f, "company_name", 160), address_input: value(f, "postal_address", 500) });
  if (error) throw new Error("Your business profile could not be saved. Check the company and postal address.");
  return { redirect: "/leads/account" };
}); }
export async function requestOfferAccess(f: FormData) { return result(async () => {
  const b = await buyer(); const id = value(f, "listing_id", 36);
  const { data: offer } = await marketDb().from("chillbros_market_listings").select("id").eq("id", id).eq("status", "published").maybeSingle();
  if (!offer) throw new Error("This offer is unavailable.");
  const { error } = await marketDb().from("chillbros_market_requests").upsert({ buyer_id: b.id, listing_id: id }, { onConflict: "buyer_id,listing_id", ignoreDuplicates: true });
  if (error) throw new Error("Could not request access.");
  return { notice: "Access requested. We will review the source and sharing permissions for your business." };
}); }
export async function buyOffer(f: FormData) { return result(async () => {
  const b = await buyer(); if (f.get("terms") !== "on") throw new Error("Accept the offer's license and buyer terms.");
  const { data, error } = await marketDb().rpc("chillbros_market_reserve_order", { buyer_input: b.id, listing_input: value(f, "listing_id", 36) });
  if (error || !data) throw new Error(error?.message || "Offer could not be reserved.");
  return { redirect: `/leads/orders/${data}` };
}); }
export async function payOrder(f: FormData) { return result(async () => { const b = await buyer(); return { redirect: await openMarketCheckout(value(f, "order_id", 36), b.id) }; }); }
export async function checkOrderPayment(f: FormData) { return result(async () => { const b = await buyer(); const status = await reconcileMarketOrder(value(f, "order_id", 36), b.id); return { notice: status === "delivered" ? "Payment verified. Your lead is available below." : status === "refund_required" ? "Payment received; fulfillment needs review. Support will resolve or refund it." : "Payment has not yet been confirmed." }; }); }
export async function cancelOrder(f: FormData) { return result(async () => { const b = await buyer(); await cancelMarketOrder(value(f, "order_id", 36), b.id); return { notice: "Unpaid checkout cancelled." }; }); }
export async function submitClaim(f: FormData) { return result(async () => {
  const b = await buyer(); const id = value(f, "order_id", 36); const reason = value(f, "reason", 3000);
  const { data: order } = await marketDb().from("chillbros_market_orders").select("id,delivered_at,status").eq("id", id).eq("buyer_id", b.id).maybeSingle();
  if (!order?.delivered_at || !["delivered", "refund_required"].includes(order.status)) throw new Error("A delivered order is required.");
  if (Date.parse(order.delivered_at) < Date.now() - 7 * 86400000) throw new Error("The seven-day online claim window ended. Contact support for review.");
  if (reason.length < 20) throw new Error("Describe the incorrect contact, duplicate, wrong business or other issue in at least 20 characters.");
  const { error } = await marketDb().from("chillbros_market_claims").insert({ order_id: id, buyer_id: b.id, reason });
  if (error) throw new Error("A claim may already exist. Check your account or contact support.");
  return { notice: "Your quality claim is recorded for review." };
}); }
export async function saveOutcome(f: FormData) { return result(async () => {
  const b = await buyer(); const id = value(f, "order_id", 36); const stage = value(f, "stage", 30);
  if (!["new", "contacted", "responded", "appointment", "won", "lost", "do_not_contact"].includes(stage)) throw new Error("Select an outcome.");
  const { data: order } = await marketDb().from("chillbros_market_orders").select("id,lead_snapshot").eq("id", id).eq("buyer_id", b.id).eq("status", "delivered").maybeSingle();
  if (!order) throw new Error("Delivered order not found.");
  if (stage === "do_not_contact") {
    const email = String(order.lead_snapshot?.contact_email ?? "").trim().toLowerCase();
    if (!email) throw new Error("No contact available to suppress.");
    const saved = await marketDb().from("chillbros_market_suppressions").upsert({ buyer_id: b.id, contact: email, reason: "Buyer recorded do not contact" });
    if (saved.error) throw new Error("Could not save the contact restriction.");
  }
  const { error } = await marketDb().from("chillbros_market_outcomes").upsert({ order_id: id, buyer_id: b.id, stage, notes: value(f, "notes", 2000), updated_at: new Date().toISOString() });
  if (error) throw new Error("Could not save the outcome.");
  return { notice: "Outcome saved." };
}); }
export async function setBuyerAutomation(f: FormData) { return result(async () => {
  const b = await buyer(); const enabled = f.get("automation_enabled") === "on";
  if (enabled && (b.status !== "active" || f.get("confirm") !== "on")) throw new Error("Active business approval and explicit sending consent are required.");
  const { error } = await marketDb().from("chillbros_market_buyers").update({ automation_enabled: enabled }).eq("id", b.id);
  if (error) throw new Error("Could not update automation.");
  return { notice: enabled ? "Your consent is saved. Owner holds and qualification checks still apply before any send." : "Automation disabled." };
}); }
