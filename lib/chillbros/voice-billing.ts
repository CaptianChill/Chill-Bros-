import "server-only";

import { askAI } from "@/lib/chillbros/ai";
import { createServiceRoleClient } from "@/lib/supabase/service-client";

// Voice quote/invoice drafting.
// The owner talks; the AI turns it into a structured draft; the server fills in any price he
// didn't say out loud from what he has actually charged before (this customer first, then
// everyone), then the catalog. Every document he sends becomes more pricing memory, so the
// drafts get closer to his real prices the more he uses it. Nothing is created or sent here —
// the draft goes back to the review screen and through the normal create action.

export type PriceSource = "spoken" | "customer_history" | "your_history" | "catalog" | "needs_price";
export type VoiceLine = {
  label: string;
  description: string;
  partNumber: string;
  quantity: number;
  unitPrice: number;
  taxable: boolean;
  preset: string; // "part:<id>" | "fee:<id>" | "pb:<code>" | ""
  priceSource: PriceSource;
  priceNote: string;
};
export type VoiceDraft = {
  documentType: "quote" | "invoice";
  customer: { id: string | null; name: string; phone: string; email: string; address: string };
  jobLocation: string;
  jobDescription: string;
  workPerformed: string;
  equipment: { type: string; manufacturer: string; model: string; serial: string; refrigerant: string } | null;
  lines: VoiceLine[];
  discount: number;
  taxRate: number;
  downPaymentType: "" | "percent" | "dollar";
  downPaymentValue: number;
  paymentTerms: "due_on_receipt" | "net_7" | "net_15" | "net_30" | "custom";
  customDueDate: string;
  notes: string;
  sendVia: "none" | "email" | "sms";
  warnings: string[];
};

type CatalogRow = { id: string; name: string; part_number: string | null; retail_price: number | null };
type FeeRow = { id: string; label: string; amount: number | null };
type CustomerRow = { id: string; name: string; phone: string | null; email: string | null; address: string | null };
type HistoryLine = { label: string; description: string | null; unit_price: number; taxable: boolean; at: string; customerId: string | null; invoiceNumber: string };

const MAX_LINES = 20;
const TERMS = new Set(["due_on_receipt", "net_7", "net_15", "net_30", "custom"]);

const str = (v: unknown, max = 500) => (typeof v === "string" ? v.trim().slice(0, max) : typeof v === "number" ? String(v) : "");
const num = (v: unknown) => { if (v === null || v === undefined || (typeof v === "string" && !v.trim())) return null; const n = typeof v === "number" ? v : Number(String(v ?? "").replace(/[$,%\s]/g, "")); return Number.isFinite(n) ? n : null; };
export const normText = (v: string | null | undefined) => String(v ?? "").toLowerCase().replace(/[^a-z0-9/.]+/g, " ").replace(/\s+/g, " ").trim();
const normPart = (v: string | null | undefined) => String(v ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const digits = (v: string | null | undefined) => String(v ?? "").replace(/\D/g, "");
const STOP = new Set(["the", "a", "an", "and", "of", "for", "to", "new", "replace", "replaced", "replacement", "install", "installed", "x", "per", "unit", "w", "with"]);
const tokens = (v: string) => new Set(normText(v).split(" ").filter((t) => t && !STOP.has(t)));

// Similarity between a spoken line and a past line. Part numbers win outright.
export function lineSimilarity(a: { label: string; partNumber?: string }, b: { label: string; description?: string | null }) {
  const pa = normPart(a.partNumber);
  if (pa.length >= 4) {
    const hay = normPart(`${b.label} ${b.description ?? ""}`);
    if (hay.includes(pa)) return 1;
  }
  if (normText(a.label) && normText(a.label) === normText(b.label)) return 1;
  const ta = tokens(a.label), tb = tokens(b.label);
  if (!ta.size || !tb.size) return 0;
  let shared = 0; for (const t of ta) if (tb.has(t)) shared += 1;
  return shared / Math.max(ta.size, tb.size);
}

export function bestHistoryPrice(line: { label: string; partNumber?: string }, history: HistoryLine[], customerId: string | null) {
  const pick = (rows: HistoryLine[]) => {
    let best: { row: HistoryLine; score: number } | null = null;
    for (const row of rows) {
      const score = lineSimilarity(line, row);
      // History is newest-first, so ties keep the most recent price.
      if (score >= 0.67 && (!best || score > best.score)) best = { row, score };
    }
    return best?.row ?? null;
  };
  if (customerId) {
    const mine = pick(history.filter((h) => h.customerId === customerId));
    if (mine) return { source: "customer_history" as const, row: mine };
  }
  const any = pick(history);
  return any ? { source: "your_history" as const, row: any } : null;
}

async function loadContext() {
  const supabase = createServiceRoleClient();
  const [customers, catalog, fees, invoices] = await Promise.all([
    supabase.from("chillbros_customers").select("id,name,phone,email,address").order("created_at", { ascending: false }).limit(1500),
    supabase.from("chillbros_parts_catalog").select("id,name,part_number,retail_price").order("name").limit(1500),
    supabase.from("chillbros_fee_settings").select("id,label,amount").order("sort_order"),
    supabase.from("chillbros_invoices").select("id,customer_id,invoice_number,created_at").is("revoked_at", null).neq("status", "void").order("created_at", { ascending: false }).limit(600),
  ]);
  const invoiceRows = (invoices.data ?? []) as { id: string; customer_id: string | null; invoice_number: string; created_at: string }[];
  const byId = new Map(invoiceRows.map((i) => [i.id, i]));
  const history: HistoryLine[] = [];
  // Line items for those invoices, fetched in chunks to keep the URL short.
  for (let i = 0; i < invoiceRows.length; i += 150) {
    const ids = invoiceRows.slice(i, i + 150).map((r) => r.id);
    const { data } = await supabase.from("chillbros_invoice_line_items").select("invoice_id,label,description,unit_price,amount,quantity,taxable").in("invoice_id", ids);
    for (const row of data ?? []) {
      const inv = byId.get(row.invoice_id); if (!inv) continue;
      const unit = Number(row.unit_price ?? (Number(row.quantity) ? Number(row.amount) / Number(row.quantity) : row.amount));
      if (!Number.isFinite(unit) || unit <= 0 || !row.label) continue;
      history.push({ label: row.label, description: row.description, unit_price: unit, taxable: Boolean(row.taxable), at: inv.created_at, customerId: inv.customer_id, invoiceNumber: inv.invoice_number });
    }
  }
  history.sort((a, b) => b.at.localeCompare(a.at));
  return { customers: (customers.data ?? []) as CustomerRow[], catalog: (catalog.data ?? []) as CatalogRow[], fees: (fees.data ?? []) as FeeRow[], history };
}

function extractJson(text: string): Record<string, unknown> | null {
  const start = text.indexOf("{"), end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(text.slice(start, end + 1)); } catch { return null; }
}

const SYSTEM = `You turn an HVAC/R business owner's spoken words into a quote or invoice draft for Chill Pros (San Antonio, TX).
Return ONLY one JSON object, no prose, with this shape:
{"documentType":"quote"|"invoice",
 "customer":{"index":number|null,"name":"","phone":"","email":"","address":""},
 "jobLocation":"","jobDescription":"","workPerformed":"",
 "equipment":null|{"type":"","manufacturer":"","model":"","serial":"","refrigerant":""},
 "lines":[{"label":"","partNumber":"","description":"","quantity":1,"unitPrice":null,"taxable":null,"catalog":null|"P12"|"F3"}],
 "discount":0,"taxRate":null,"downPaymentType":""|"percent"|"dollar","downPaymentValue":0,
 "paymentTerms":"due_on_receipt"|"net_7"|"net_15"|"net_30"|"custom","customDueDate":"YYYY-MM-DD or empty",
 "notes":"","sendVia":"none"|"email"|"sms","warnings":[]}
Rules:
- customer.index: the number of the matching existing customer from the CUSTOMERS list (allow for speech-to-text misspellings). null if it's a new customer; then fill name/phone/email/address from what was said.
- One line per part, labor, trip/service fee, material or charge. Keep part numbers exactly as spoken (e.g. "P291-4553RS", "POE 45/5"). Spell out numbers said as words.
- unitPrice: ONLY if the owner said a price for that line (each/per hour/total for that line ÷ quantity). Otherwise null — never invent a price.
- Labor "2 hours at 125" → quantity 2, unitPrice 125. "Labor 250" → quantity 1, unitPrice 250.
- catalog: the code of the CATALOG item (P#) or SERVICE FEE (F#) that is clearly the same thing, else null.
- taxable: true for parts/materials/equipment, false for labor/fees/trip charges, null if unsure.
- Down payment "half down"/"50 percent down" → percent 50; "$500 down" → dollar 500.
- taxRate only if spoken (e.g. "no tax" → 0). discount in dollars only if spoken.
- documentType "invoice" if they say invoice/bill/charge them for work done; "quote" for quote/estimate/proposal. Default to the CURRENT TYPE given.
- sendVia "email" or "sms" only if they say to email/text/send it; "none" otherwise.
- notes: customer-facing summary, warranty or terms they dictate. workPerformed: internal tech notes they dictate.
- If a PREVIOUS DRAFT is given, the new words are changes to it: return the full updated draft, keeping everything not changed (keep existing unitPrice values unless they change them). "Remove X", "change Y to Z", "add another hour" all edit the previous draft.
- warnings: short notes about anything unclear (e.g. "Didn't catch the customer's email").`;

export async function buildVoiceDraft(input: { transcript: string; documentType: "quote" | "invoice"; previous: VoiceDraft | null }): Promise<{ ok: true; draft: VoiceDraft } | { ok: false; error: string }> {
  const ctx = await loadContext();
  const customerList = ctx.customers.map((c, i) => `${i}: ${c.name}${c.phone ? ` | ${c.phone}` : ""}${c.address ? ` | ${c.address.slice(0, 60)}` : ""}`).join("\n");
  const catalogList = ctx.catalog.slice(0, 700).map((p, i) => `P${i}: ${p.name}${p.part_number ? ` | ${p.part_number}` : ""} | $${Number(p.retail_price ?? 0)}`).join("\n");
  const feeList = ctx.fees.map((f, i) => `F${i}: ${f.label} | $${Number(f.amount ?? 0)}`).join("\n");
  const prevForAi = input.previous ? JSON.stringify({ ...input.previous, customer: { ...input.previous.customer, index: input.previous.customer.id ? ctx.customers.findIndex((c) => c.id === input.previous?.customer.id) : null }, lines: input.previous.lines.map((l) => ({ label: l.label, partNumber: l.partNumber, description: l.description, quantity: l.quantity, unitPrice: l.unitPrice || null, taxable: l.taxable })) }) : "none";

  const ai = await askAI({
    system: SYSTEM,
    messages: [{ role: "user", content: `CURRENT TYPE: ${input.documentType}\n\nCUSTOMERS:\n${customerList || "(none)"}\n\nCATALOG:\n${catalogList || "(none)"}\n\nSERVICE FEES:\n${feeList || "(none)"}\n\nPREVIOUS DRAFT:\n${prevForAi}\n\nOWNER SAID:\n"""${input.transcript.slice(0, 6000)}"""` }],
    maxTokens: 3500,
    timeoutMs: 60000,
    reasoningEffort: "low",
  });
  if (!ai.ok) return { ok: false, error: ai.error };
  const raw = extractJson(ai.text);
  if (!raw) return { ok: false, error: "The AI answer couldn't be read. Try saying it again." };
  return { ok: true, draft: finalizeDraft(raw, ctx, input) };
}

export function finalizeDraft(raw: Record<string, unknown>, ctx: { customers: CustomerRow[]; catalog: CatalogRow[]; fees: FeeRow[]; history: HistoryLine[] }, input: { documentType: "quote" | "invoice"; previous: VoiceDraft | null }): VoiceDraft {
  const warnings = Array.isArray(raw.warnings) ? raw.warnings.map((w) => str(w, 200)).filter(Boolean).slice(0, 6) : [];
  const rc = (raw.customer ?? {}) as Record<string, unknown>;
  const idx = num(rc.index);
  let match: CustomerRow | null = idx !== null && Number.isInteger(idx) && idx >= 0 && idx < ctx.customers.length ? ctx.customers[idx] : null;
  const spoken = { name: str(rc.name, 200), phone: str(rc.phone, 50), email: str(rc.email, 200).toLowerCase(), address: str(rc.address, 500) };
  // Safety net: exact phone/email/name match even if the AI said "new".
  if (!match) match = ctx.customers.find((c) => (spoken.email && normText(c.email) === normText(spoken.email)) || (digits(spoken.phone).length >= 7 && digits(c.phone) === digits(spoken.phone)) || (spoken.name && normText(c.name) === normText(spoken.name))) ?? null;
  const customer = match
    ? { id: match.id, name: match.name, phone: match.phone ?? "", email: match.email ?? "", address: match.address ?? "" }
    : { id: null, ...spoken };
  if (!customer.id && !customer.name) warnings.push("No customer was named — pick one before creating.");

  const rawLines = Array.isArray(raw.lines) ? raw.lines.slice(0, MAX_LINES) : [];
  const lines: VoiceLine[] = [];
  for (const item of rawLines) {
    const r = (item ?? {}) as Record<string, unknown>;
    const label = str(r.label, 200); if (!label) continue;
    const partNumber = str(r.partNumber, 80);
    const qty = Math.max(0.01, Math.min(num(r.quantity) ?? 1, 999));
    const spokenPrice = num(r.unitPrice);
    const code = str(r.catalog, 10).toUpperCase();
    let preset = "", catalogPrice: number | null = null, catalogName = "";
    if (/^P\d+$/.test(code)) { const p = ctx.catalog[Number(code.slice(1))]; if (p) { preset = String(p.part_number ?? "").startsWith("PB-") ? `pb:${p.part_number}` : `part:${p.id}`; catalogPrice = Number(p.retail_price ?? 0); catalogName = p.name; } }
    else if (/^F\d+$/.test(code)) { const f = ctx.fees[Number(code.slice(1))]; if (f) { preset = `fee:${f.id}`; catalogPrice = Number(f.amount ?? 0); catalogName = f.label; } }
    // Part number said out loud but the AI didn't map it: try an exact catalog part-number match.
    if (!preset && normPart(partNumber).length >= 4) { const p = ctx.catalog.find((c) => normPart(c.part_number) === normPart(partNumber)); if (p) { preset = String(p.part_number ?? "").startsWith("PB-") ? `pb:${p.part_number}` : `part:${p.id}`; catalogPrice = Number(p.retail_price ?? 0); catalogName = p.name; } }

    let unitPrice = 0, priceSource: PriceSource = "needs_price", priceNote = "No price said and none on file — enter one.";
    let taxable = typeof r.taxable === "boolean" ? r.taxable : !/labor|labour|trip|service call|diagnos|fee|hour/i.test(label);
    // Keep a price the owner already confirmed on an earlier pass of this draft.
    const kept = input.previous?.lines.find((l) => normText(l.label) === normText(label) && l.unitPrice > 0 && l.priceSource !== "needs_price");
    if (spokenPrice !== null && spokenPrice >= 0) { unitPrice = spokenPrice; priceSource = "spoken"; priceNote = "You said this price."; }
    else if (kept) { unitPrice = kept.unitPrice; priceSource = kept.priceSource; priceNote = kept.priceNote; }
    else {
      const hist = bestHistoryPrice({ label: catalogName || label, partNumber }, ctx.history, customer.id) ?? (catalogName ? bestHistoryPrice({ label, partNumber }, ctx.history, customer.id) : null);
      if (hist) {
        unitPrice = Math.round(hist.row.unit_price * 100) / 100; priceSource = hist.source;
        priceNote = `${hist.source === "customer_history" ? `What you charged ${customer.name || "this customer"}` : "What you charged last time"} — ${hist.row.invoiceNumber}, ${hist.row.at.slice(0, 10)}`;
        if (typeof r.taxable !== "boolean") taxable = hist.row.taxable;
      } else if (catalogPrice !== null && catalogPrice > 0) { unitPrice = catalogPrice; priceSource = "catalog"; priceNote = `Price book: ${catalogName}`; }
    }
    lines.push({ label, description: str(r.description, 300) || (partNumber ? `Part # ${partNumber}` : ""), partNumber, quantity: Math.round(qty * 100) / 100, unitPrice: Math.max(0, Math.round(unitPrice * 100) / 100), taxable, preset, priceSource, priceNote });
  }
  if (!lines.length) warnings.push("No parts, labor, or charges were heard yet.");
  if (lines.some((l) => l.priceSource === "needs_price")) warnings.push("Some lines still need a price.");

  const eq = raw.equipment && typeof raw.equipment === "object" ? raw.equipment as Record<string, unknown> : null;
  const equipment = eq && str(eq.type, 120) ? { type: str(eq.type, 120), manufacturer: str(eq.manufacturer, 160), model: str(eq.model, 160), serial: str(eq.serial, 160), refrigerant: str(eq.refrigerant, 80) } : null;
  const dpType = raw.downPaymentType === "percent" || raw.downPaymentType === "dollar" ? raw.downPaymentType : "";
  const dpValue = dpType ? Math.max(0, Math.min(num(raw.downPaymentValue) ?? 0, dpType === "percent" ? 100 : 250000)) : 0;
  const taxSpoken = num(raw.taxRate);
  const terms = TERMS.has(String(raw.paymentTerms)) ? String(raw.paymentTerms) as VoiceDraft["paymentTerms"] : (input.previous?.paymentTerms ?? "due_on_receipt");
  const due = str(raw.customDueDate, 10);
  return {
    documentType: raw.documentType === "invoice" ? "invoice" : raw.documentType === "quote" ? "quote" : input.documentType,
    customer,
    jobLocation: str(raw.jobLocation, 500),
    jobDescription: str(raw.jobDescription, 400),
    workPerformed: str(raw.workPerformed, 4000),
    equipment,
    lines,
    discount: Math.max(0, num(raw.discount) ?? 0),
    taxRate: taxSpoken !== null && taxSpoken >= 0 && taxSpoken <= 25 ? taxSpoken : (input.previous?.taxRate ?? 8.25),
    downPaymentType: dpType,
    downPaymentValue: dpValue,
    paymentTerms: terms,
    customDueDate: /^\d{4}-\d{2}-\d{2}$/.test(due) ? due : "",
    notes: str(raw.notes, 2000),
    sendVia: raw.sendVia === "email" || raw.sendVia === "sms" ? raw.sendVia : "none",
    warnings,
  };
}
