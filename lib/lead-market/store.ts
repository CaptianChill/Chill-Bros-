import "server-only";
import { redirect } from "next/navigation";
import { marketSession } from "./auth";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import { createServiceRoleClient } from "@/lib/supabase/service-client";

export type Buyer = { id: string; account_id: string; email: string; company_name: string; postal_address: string; status: string; sender_key: string; automation_enabled: boolean; daily_cap: number };
export type Offer = { id: string; prospect_id?: string; title: string; public_summary: string; city: string; service_line: string; tier: string; sale_type: string; max_buyers: number; price_cents: number; status: string };
export type MarketOrder = { id: string; buyer_id: string; listing_id: string; status: string; total_cents: number; price_cents: number; tax_cents: number; checkout_state: string; checkout_url: string | null; square_order_id: string | null; square_link_id: string | null; square_payment_id: string | null; lead_snapshot: Record<string, unknown> | null; delivered_at: string | null; created_at: string };
export const marketDb = createServiceRoleClient;

export async function marketManager() {
  const profile = await getCurrentStaffProfile();
  if (!profile || profile.role !== "manager" || profile.status !== "active") throw new Error("Active manager access required.");
  return profile;
}
export async function currentBuyer(): Promise<Buyer | null> {
  const session = await marketSession();
  if (!session) return null;
  const { data, error } = await marketDb().from("chillbros_market_buyers").select("id,account_id,email,company_name,postal_address,status,sender_key,automation_enabled,daily_cap").eq("account_id", session.accountId).maybeSingle();
  if (error) throw new Error("Buyer account is temporarily unavailable.");
  return data as Buyer | null;
}
export async function requireBuyer() {
  if (!await marketSession()) redirect("/leads/sign-in");
  const buyer = await currentBuyer();
  if (!buyer) redirect("/leads/join");
  if (buyer.status === "suspended") throw new Error("This account is suspended. Contact support.");
  return buyer;
}
export async function marketSettings() {
  const { data, error } = await marketDb().from("chillbros_market_settings").select("*").eq("id", 1).single();
  if (error || !data) throw new Error("Marketplace settings are unavailable.");
  return data;
}
export async function buyerOrder(id: string, buyerId: string): Promise<MarketOrder> {
  const { data, error } = await marketDb().from("chillbros_market_orders").select("*").eq("id", id).eq("buyer_id", buyerId).maybeSingle();
  if (error || !data) throw new Error("Order not found.");
  return data as MarketOrder;
}
/** Purchased snapshots stay stable; later opt-outs are applied to every view/export. */
export async function deliveredLead(order: MarketOrder): Promise<Record<string, unknown> | null> {
  if (order.status !== "delivered" || !order.lead_snapshot) return null;
  const db = marketDb();
  const email = String(order.lead_snapshot.contact_email ?? "").trim().toLowerCase();
  const [{ data: listing, error: le }, { data: suppression, error: se }, { data: local, error: be }, { data: contactDnc, error: ce }] = await Promise.all([
    db.from("chillbros_market_listings").select("prospect_id").eq("id", order.listing_id).single(),
    db.from("chillbros_outreach_suppressions").select("contact").eq("contact", email).maybeSingle(),
    db.from("chillbros_market_suppressions").select("contact").eq("buyer_id", order.buyer_id).eq("contact", email).maybeSingle(),
    db.from("chillbros_revenue_contacts").select("email").eq("email", email).eq("do_not_contact", true).limit(1),
  ]);
  if (le || se || be || ce || !listing) throw new Error("Contact restrictions could not be checked.");
  const { data: lead, error } = await db.from("chillbros_revenue_prospects").select("do_not_contact,contact_email").eq("id", listing.prospect_id).single();
  if (error || !lead) throw new Error("Current contact restrictions are unavailable.");
  if (suppression || local || contactDnc?.length || lead.do_not_contact || String(lead.contact_email).trim().toLowerCase() !== email) {
    return { ...order.lead_snapshot, contact_email: null, contact_phone: null, contact_name: null, restriction: "Contact changed or opted out after delivery. Do not use the previous contact." };
  }
  return order.lead_snapshot;
}
