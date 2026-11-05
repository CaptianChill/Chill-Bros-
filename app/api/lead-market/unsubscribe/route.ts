import { NextResponse } from "next/server";
import { validOptOut } from "@/lib/lead-market/secrets";
import { emailAddress } from "@/lib/lead-market/rules";
import { marketDb } from "@/lib/lead-market/store";
import { marketBase as appBase } from "@/lib/lead-market/config";
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  return NextResponse.redirect(`${appBase()}/leads/unsubscribe?${q.toString()}`);
}
export async function POST(request: Request) {
  const q = new URL(request.url).searchParams; const buyer = q.get("buyer") || ""; const email = emailAddress(q.get("email"));
  if (!email || !validOptOut(buyer, email, q.get("sig") || "")) return new Response("Invalid unsubscribe link", { status: 403 });
  const { error } = await marketDb().from("chillbros_market_suppressions").upsert({ buyer_id: buyer, contact: email, reason: "Contact unsubscribed" });
  if (error) return new Response("Could not save opt-out. Please retry.", { status: 503 });
  return new Response("You are unsubscribed from this business's platform outreach.", { headers: { "Cache-Control": "no-store" } });
}
