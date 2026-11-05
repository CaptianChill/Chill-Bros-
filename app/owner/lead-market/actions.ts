"use server";
import { revalidatePath } from "next/cache";
import { marketDb, marketManager } from "@/lib/lead-market/store";
import { cents, cleanText, emailAddress } from "@/lib/lead-market/rules";
import { marketPaymentsConfigured, refundMarketOrder, reconcileMarketOrder, recoverMarketCheckout } from "@/lib/lead-market/commerce";
import type { MarketResult } from "@/components/lead-market/form";
const text = (f: FormData, k: string, max = 1000) => cleanText(f.get(k), max);
async function ownerAction(fn: (manager: Awaited<ReturnType<typeof marketManager>>) => Promise<void>): Promise<MarketResult> {
  try { const manager = await marketManager(); await fn(manager); revalidatePath("/owner/lead-market"); revalidatePath("/leads", "layout"); return { ok: true, notice: "Saved." }; }
  catch (e) { return { ok: false, error: e instanceof Error ? e.message : "Request failed." }; }
}
export async function saveLaunchSettings(f: FormData) { return ownerAction(async () => {
  const tax = Math.round(Number(f.get("tax_rate")) * 100); const support = emailAddress(f.get("support_email"));
  const seller = text(f, "seller_name", 160); const address = text(f, "seller_address", 500);
  if (!support || !Number.isInteger(tax) || tax < 0 || tax > 2000) throw new Error("Set a valid support email and reviewed tax percentage (0–20).");
  const sales = f.get("sales_enabled") === "on"; const terms = f.get("terms_reviewed") === "on"; const taxReviewed = f.get("tax_reviewed") === "on";
  if (sales && (!marketPaymentsConfigured() || !terms || !taxReviewed || seller.length < 2 || address.length < 10)) throw new Error("Payment configuration, seller identity, terms and tax review must be complete before sales open.");
  const { error } = await marketDb().from("chillbros_market_settings").update({ brand_name: text(f, "brand_name", 160) || "Lead marketplace", support_email: support, seller_name: seller, seller_address: address, tax_rate_bps: tax, terms_reviewed: terms, tax_reviewed: taxReviewed, sales_enabled: sales, outreach_enabled: f.get("outreach_enabled") === "on" }).eq("id", 1);
  if (error) throw new Error("Settings could not be saved.");
}); }
export async function saveBuyerStatus(f: FormData) { return ownerAction(async () => {
  const status = text(f, "status", 20); if (!["pending", "active", "suspended"].includes(status)) throw new Error("Select a business status.");
  const cap = Number(f.get("daily_cap")); if (!Number.isInteger(cap) || cap < 1 || cap > 50) throw new Error("Daily cap must be 1–50.");
  if (status === "active" && f.get("identity_reviewed") !== "on") throw new Error("Confirm this buyer's business identity and postal address were reviewed.");
  const { error } = await marketDb().from("chillbros_market_buyers").update({ status, daily_cap: cap, ...(status !== "active" ? { automation_enabled: false } : {}) }).eq("id", text(f, "buyer_id", 36));
  if (error) throw new Error("Buyer update failed.");
}); }
export async function saveMarketListing(f: FormData) { return ownerAction(async (manager) => {
  const id = text(f, "id", 36); const prospectId = text(f, "prospect_id", 36); const mode = text(f, "sale_type", 20); const status = text(f, "status", 20); const tier = text(f, "tier", 30);
  const price = cents(f.get("price")); const cap = mode === "exclusive" ? 1 : Number(f.get("max_buyers"));
  if (!["shared", "exclusive"].includes(mode) || !["draft", "published", "paused"].includes(status) || !["researched_prospect", "confirmed_need"].includes(tier) || !Number.isInteger(cap) || cap < 1 || cap > 5 || price > 500000) throw new Error("Check the offer type, tier, capacity and price.");
  const db = marketDb(); const { data: p, error: pe } = await db.from("chillbros_revenue_prospects").select("id,city,service_line,do_not_contact").eq("id", prospectId).single();
  if (pe || !p || p.do_not_contact) throw new Error("An available prospect is required.");
  if (status === "published") {
    if (price < 100 || f.get("public_copy_reviewed") !== "on") throw new Error("Set a price of at least $1 and confirm the public copy reveals no contact identity or unsupported need claims.");
    const { data: review } = await db.from("chillbros_outreach_reviews").select("verdict,resale_permitted,source_checked_at").eq("prospect_id", prospectId).eq("sender_key", "chill-pros").order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!review || review.verdict !== "approved" || !review.resale_permitted || Date.parse(review.source_checked_at) < Date.now() - 30 * 86400000) throw new Error("Review and document resale rights for the source before publishing.");
  }
  const row = { ...(id ? { id } : {}), prospect_id: prospectId, title: text(f, "title", 160), public_summary: text(f, "public_summary", 1200), city: p.city, service_line: p.service_line, tier, sale_type: mode, max_buyers: cap, price_cents: price, status, created_by: manager.id };
  const { error } = await db.from("chillbros_market_listings").upsert(row, { onConflict: "prospect_id" });
  if (error) throw new Error(error.message);
}); }
export async function reconcileOwnerOrder(f: FormData) { return ownerAction(async () => {
  const { data: o } = await marketDb().from("chillbros_market_orders").select("id,buyer_id").eq("id", text(f, "order_id", 36)).single();
  if (!o) throw new Error("Order not found.");
  await reconcileMarketOrder(o.id, o.buyer_id);
}); }
export async function recoverOwnerCheckout(f: FormData) { return ownerAction(async () => { await recoverMarketCheckout(text(f, "order_id", 36)); }); }
export async function issueMarketRefund(f: FormData) { return ownerAction(async () => {
  if (f.get("confirm_refund") !== "on") throw new Error("Confirm the full refund before submitting.");
  await refundMarketOrder(text(f, "order_id", 36));
}); }
export async function resolveMarketClaim(f: FormData) { return ownerAction(async () => {
  const status = text(f, "status", 20); const resolution = text(f, "resolution", 2000);
  if (!["approved", "declined", "resolved"].includes(status) || resolution.length < 10) throw new Error("Choose a decision and write the resolution.");
  const { error } = await marketDb().from("chillbros_market_claims").update({ status, resolution }).eq("id", text(f, "claim_id", 36));
  if (error) throw new Error("Claim update failed.");
}); }
