import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service-client";

import { productByKey } from "./catalog";

export type DeliveredProject = {
  key: string; industry: "food" | "auto"; title: string;
  address: string; contact: string; role: string; phone: string; project: string; timing: string; source_url: string; opener: string;
};
export type DeliveredContact = { name: string; address: string; phone: string; type: string; area: string; opener: string };
export type Delivery = {
  orderId: string; squareRef: string; product: string; productName: string; trade: string; buyerEmail: string; buyerName: string | null;
  createdAt: string; projects: DeliveredProject[]; contacts: DeliveredContact[];
};

const LEGACY_NAMES: Record<string, string> = {
  legacy_starter: "Commercial Starter Pack", legacy_auto: "Auto Openings Pack", legacy_food: "Restaurant & Retail Openings Pack",
  legacy_openings: "New Openings Pack", legacy_bundle: "Founding Bundle",
};

/** One order's licensed content, or null when the token is unknown or the order was revoked. Records the open. */
export async function loadDelivery(token: string): Promise<Delivery | null> {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const db = createServiceRoleClient();
  const { data: order } = await db.from("chillbros_leadpack_orders")
    .select("id,square_ref,product,trade,buyer_email,buyer_name,status,created_at,first_opened_at,open_count")
    .eq("token", token).maybeSingle();
  if (!order || order.status !== "delivered" || !order.trade) return null;

  const [{ data: rows }, { data: product }] = await Promise.all([
    db.from("chillbros_leadpack_deliveries").select("project_key, chillbros_leadpack_projects(key,industry,title,data)").eq("order_id", order.id),
    db.from("chillbros_leadpack_products").select("contacts").eq("key", order.product).maybeSingle(),
  ]);
  const wantContacts = Number(product?.contacts ?? 0);
  const { data: contactRows } = wantContacts > 0
    ? await db.from("chillbros_leadpack_contacts").select("data").eq("trade", order.trade).order("position").limit(wantContacts)
    : { data: [] as { data: DeliveredContact }[] };

  await db.from("chillbros_leadpack_orders")
    .update({ first_opened_at: order.first_opened_at ?? new Date().toISOString(), open_count: (order.open_count ?? 0) + 1 })
    .eq("id", order.id);

  const projects = (rows ?? []).flatMap((r) => {
    const p = (Array.isArray(r.chillbros_leadpack_projects) ? r.chillbros_leadpack_projects[0] : r.chillbros_leadpack_projects) as
      { key: string; industry: "food" | "auto"; title: string; data: Record<string, unknown> } | null;
    if (!p) return [];
    const d = p.data as { address: string; contact: string; role: string; phone: string; project: string; timing: string; source_url: string; openers: Record<string, string> };
    return [{ key: p.key, industry: p.industry, title: p.title, address: d.address, contact: d.contact, role: d.role, phone: d.phone,
      project: d.project, timing: d.timing, source_url: d.source_url, opener: d.openers?.[order.trade] ?? "" }];
  }).sort((a, b) => (a.industry === b.industry ? a.title.localeCompare(b.title) : a.industry === "food" ? -1 : 1));

  return {
    orderId: order.id, squareRef: order.square_ref, product: order.product,
    productName: productByKey(order.product)?.name ?? LEGACY_NAMES[order.product] ?? order.product,
    trade: order.trade, buyerEmail: order.buyer_email, buyerName: order.buyer_name, createdAt: order.created_at,
    projects, contacts: (contactRows ?? []).map((c) => c.data as DeliveredContact),
  };
}

// Quote every cell; a leading = + - @ gets an apostrophe so Excel never runs it as a formula.
const cell = (v: unknown) => `"${String(v ?? "").replace(/^([=+\-@])/, "'$1").replace(/"/g, '""')}"`;

/** Spreadsheet (CSV) of one delivery, stamped with who it's licensed to. */
export function deliveryCsv(d: Delivery) {
  const stamp = `Licensed to ${d.buyerName ?? d.buyerEmail} (${d.buyerEmail}) · Order ${d.squareRef} · Not for resale or sharing`;
  const lines = [
    [stamp].map(cell).join(","),
    "",
    ["Business / Project", "Industry", "Address", "Contact", "Role", "Phone", "Project", "Timing", "TDLR record", "Call opener"].map(cell).join(","),
    ...d.projects.map((p) => [p.title, p.industry === "auto" ? "Auto" : "Restaurant & retail", p.address, p.contact, p.role, p.phone, p.project, p.timing, p.source_url, p.opener].map(cell).join(",")),
  ];
  if (d.contacts.length) {
    lines.push("", ["Business", "Address", "Phone", "Type", "Area", "Call opener"].map(cell).join(","),
      ...d.contacts.map((c) => [c.name, c.address, c.phone, c.type, c.area, c.opener].map(cell).join(",")));
  }
  return "﻿" + lines.join("\r\n") + "\r\n";
}
