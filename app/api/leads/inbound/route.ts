import { timingSafeEqual } from "node:crypto";

import { handleInboundLead } from "@/lib/chillbros/autopilot/inbound";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Lead intake for outside sources (website form, Google/Thumbtack/Angi via Zapier or
// an email parser). POST JSON with header "Authorization: Bearer <LEADS_INBOUND_SECRET>":
// { "source": "thumbtack", "name": "...", "email": "...", "phone": "...", "address": "...",
//   "propertyType": "residential" | "commercial", "serviceLine": "hvac_r", "message": "..." }
// The lead gets an instant reply with a private booking link.

function authorized(request: Request) {
  const secret = String(process.env.LEADS_INBOUND_SECRET || "").trim();
  if (!secret) return false;
  const given = Buffer.from(String(request.headers.get("authorization") || ""));
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function POST(request: Request) {
  if (!authorized(request)) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Send JSON." }, { status: 400 });
  }
  const pick = (...keys: string[]) => { for (const k of keys) { const v = body[k]; if (typeof v === "string" && v.trim()) return v; } return null; };
  const input = {
    source: pick("source"),
    name: pick("name", "full_name", "customer_name"),
    email: pick("email", "customer_email"),
    phone: pick("phone", "phone_number", "customer_phone"),
    address: pick("address", "service_address"),
    propertyType: pick("propertyType", "property_type"),
    serviceLine: pick("serviceLine", "service_line", "service"),
    message: pick("message", "details", "description", "notes"),
  };
  if (!input.email && !input.phone) return Response.json({ ok: false, error: "A lead needs an email or phone." }, { status: 400 });
  try {
    const result = await handleInboundLead(input);
    return Response.json({ ok: true, ...result });
  } catch (error) {
    console.error("[autopilot] inbound lead failed", error);
    return Response.json({ ok: false, error: "Could not save the lead." }, { status: 500 });
  }
}
