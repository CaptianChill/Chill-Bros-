import "server-only";

import { timingSafeEqual } from "node:crypto";

import { askAI } from "@/lib/chillbros/ai";
import { getInvoiceCenterData } from "@/lib/chillbros/billing-queries";
import { createDirectDocument, DirectDocumentError } from "@/lib/chillbros/direct-document-core";
import { sendInvoiceCommunicationAs } from "@/lib/chillbros/invoice-send-core";
import { getCalendarJobs } from "@/lib/chillbros/schedule-queries";
import { addDays, ctToday, displayTime, parseWindow } from "@/lib/chillbros/schedule-window";
import { JOB_STATUS_LABELS } from "@/lib/chillbros/types";
import { buildVoiceDraft, type VoiceDraft } from "@/lib/chillbros/voice-billing";
import { voiceDraftTotals } from "@/lib/chillbros/voice-billing-totals";
import { OWNER_PROFILE_ID } from "@/lib/supabase/auth-server";
import { createServiceRoleClient } from "@/lib/supabase/service-client";

/**
 * Owner command center (Chill Pros HQ) bridge.
 *
 * HQ never talks to this app from the browser. Its own server checks the owner's HQ
 * session, then calls /api/hq with HQ_BRIDGE_SECRET. Everything here acts as the owner.
 * Nothing is created or sent from a chat message alone: the assistant returns a card, and
 * the owner taps to confirm, which calls "create" / "remind" / "change_create".
 */

const OWNER = { id: OWNER_PROFILE_ID, role: "manager" };
const APP_URL = () => String(process.env.NEXT_PUBLIC_APP_URL || "https://chill-bros.vercel.app").replace(/\/$/, "");
const round = (n: number) => Math.round(n * 100) / 100;
const str = (v: unknown, max = 500) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export function rejectUnlessHq(request: Request): Response | null {
  const key = String(process.env.HQ_BRIDGE_SECRET || "").trim();
  if (key.length < 32) return Response.json({ ok: false, error: "Command center bridge is not configured." }, { status: 503 });
  const supplied = String(request.headers.get("x-hq-secret") || "").trim();
  const a = Buffer.from(supplied), b = Buffer.from(key);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  return null;
}

type ActivityKind = "question" | "quote_created" | "invoice_created" | "document_sent" | "reminder_sent" | "change_requested" | "change_shipped" | "change_needs_you";
async function logActivity(kind: ActivityKind, summary: string, extra: { amount?: number | null; refId?: string | null; minutesSaved?: number } = {}) {
  try {
    await createServiceRoleClient().from("chillbros_hq_activity").insert({ kind, summary: summary.slice(0, 1000), amount: extra.amount ?? null, ref_id: extra.refId ?? null, minutes_saved: Math.max(0, Math.min(600, Math.round(extra.minutesSaved ?? 0))) });
  } catch (error) {
    console.error("[hq] activity log failed", error);
  }
}

/* ------------------------------------------------------------------ snapshot */

async function trackRecord() {
  const s = createServiceRoleClient();
  const [activity, invoices, jobs, customers] = await Promise.all([
    s.from("chillbros_hq_activity").select("kind,amount,minutes_saved,created_at").order("created_at", { ascending: true }).limit(5000),
    s.from("chillbros_invoices").select("issued_at,paid_at,payment_status,created_at").is("revoked_at", null).neq("status", "void").limit(5000),
    s.from("chillbros_jobs").select("status,created_at").is("archived_at", null).limit(5000),
    s.from("chillbros_customers").select("id", { count: "exact", head: true }),
  ]);
  const acts = activity.data ?? [];
  const count = (k: string) => acts.filter((a) => a.kind === k).length;
  const issued = (invoices.data ?? []).filter((i) => i.issued_at);
  const firstDates = [...(invoices.data ?? []).map((i) => i.created_at), ...(jobs.data ?? []).map((j) => j.created_at)].filter(Boolean).sort();
  return {
    runningSince: firstDates[0] ?? null,
    customers: customers.count ?? 0,
    jobsCompleted: (jobs.data ?? []).filter((j) => ["completed", "paid", "invoice_sent", "work_complete", "ready_to_invoice"].includes(j.status)).length,
    invoicesIssued: issued.length,
    invoicesPaid: (invoices.data ?? []).filter((i) => i.payment_status === "paid").length,
    hq: {
      since: acts[0]?.created_at ?? null,
      actions: acts.length,
      documentsByVoice: count("quote_created") + count("invoice_created"),
      billedByVoice: round(acts.filter((a) => a.kind === "invoice_created").reduce((sum, a) => sum + Number(a.amount ?? 0), 0)),
      sent: count("document_sent") + count("reminder_sent"),
      questions: count("question"),
      changesShipped: count("change_shipped"),
      minutesSaved: acts.reduce((sum, a) => sum + Number(a.minutes_saved ?? 0), 0),
    },
  };
}

export async function getSnapshot() {
  const s = createServiceRoleClient();
  const today = ctToday();
  const [{ rows, metrics }, jobs, changes, recent, record] = await Promise.all([
    getInvoiceCenterData(),
    getCalendarJobs(),
    s.from("chillbros_hq_change_requests").select("id,request,status,result,pr_url,created_at,finished_at").order("created_at", { ascending: false }).limit(12),
    s.from("chillbros_hq_activity").select("kind,summary,amount,created_at").order("created_at", { ascending: false }).limit(12),
    trackRecord(),
  ]);
  const unpaid = rows
    .filter((r) => r.status === "approved" && r.paymentStatus !== "paid" && Boolean(r.issuedAt) && !r.convertedInvoiceId)
    .sort((a, b) => b.daysOverdue - a.daysOverdue)
    .map((r) => ({ id: r.id, number: r.invoiceNumber, customer: r.customerName, total: round(r.total), daysOverdue: r.daysOverdue, hasEmail: r.customerEmails.length > 0, hasPhone: Boolean(r.customerPhone), reminders: r.reminderCount, link: `${APP_URL()}/portal/${r.portalToken}` }));
  const quotes = rows
    .filter((r) => r.status === "awaiting_approval")
    .map((r) => ({ id: r.id, number: r.invoiceNumber, customer: r.customerName, total: round(r.total), link: `${APP_URL()}/portal/${r.portalToken}` }));
  const end = addDays(today, 6);
  const upcoming = jobs
    .map((job) => ({ job, w: parseWindow(job.scheduledWindow) }))
    .filter(({ w }) => w && w.date >= today && w.date <= end)
    .sort((x, y) => `${x.w!.date} ${x.w!.start}`.localeCompare(`${y.w!.date} ${y.w!.start}`))
    .slice(0, 12)
    .map(({ job, w }) => ({ id: job.id, date: w!.date, time: `${displayTime(w!.start)}–${displayTime(w!.end)}`, customer: job.customerName, tech: job.assignedTechName ?? "Unassigned", status: JOB_STATUS_LABELS[job.status] ?? job.status, scope: String(job.scope ?? "").split("\n")[0].slice(0, 120) }));
  return {
    ok: true as const,
    today,
    appUrl: APP_URL(),
    money: { outstanding: round(metrics.outstandingValue), overdue: round(metrics.overdueValue), collectedThisMonth: round(metrics.collectedThisMonth), dueToday: metrics.dueToday, quotesWaiting: metrics.pendingApproval },
    unpaid: unpaid.slice(0, 15),
    quotes: quotes.slice(0, 10),
    upcoming,
    changes: changes.data ?? [],
    recent: recent.data ?? [],
    record,
  };
}

/* ------------------------------------------------------------------ assistant */

type HistoryMsg = { role: "user" | "assistant"; content: string };
export type AskInput = { message: string; history?: HistoryMsg[]; draft?: VoiceDraft | null };

const ROUTER = `You are the Chill Pros command assistant for Brae, the owner of Chill Pros (HVAC/R and commercial refrigeration, San Antonio TX).
He talks to you by phone dictation, so expect speech-to-text mistakes and fix them silently.
Decide what he wants and return ONLY one JSON object:
{"kind":"answer"|"document"|"reminder"|"app_change","reply":"","documentType":"quote"|"invoice"|"","invoiceNumber":"","request":""}
- "document": he wants to create, change, or finish a quote/invoice/estimate/bill ("invoice Shiro 580 for the cooler", "add another hour", "email it"). If a DRAFT IS OPEN and he is talking about it (changing lines, prices, customer, "send it", "text it"), it's "document". documentType: what he asked for, or the open draft's type.
- "reminder": he wants to nudge a customer to pay an existing unpaid invoice. invoiceNumber: the matching number from UNPAID (match by number or customer name).
- "app_change": he wants one of his apps (the SOFTWARE itself) changed: a screen, button, layout, feature, wording, color, a new tool. His apps: Chill Pros CRM, Chill Pros HQ, BB Command Center (his home screen), BBB (sports betting app), Alpha Hunter (crypto), BoodaForge, Bidlume. request: start with the app in brackets, e.g. "[BBB] ..." ("[Chill Pros CRM]" if unclear), then his request rewritten as one clear, complete instruction a developer can act on.
- "answer": anything else — questions about money, unpaid invoices, quotes, schedule, customers, how the business is doing. reply: the answer, using ONLY the DATA below. Short, plain, numbers first. If the data doesn't have it, say so.
For document/reminder/app_change, reply is one short sentence saying what you're about to do.
Never invent numbers. Professional tone, no slang.`;

function extractJson(text: string): Record<string, unknown> | null {
  const a = text.indexOf("{"), b = text.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  try { return JSON.parse(text.slice(a, b + 1)); } catch { return null; }
}

export function draftBlocker(d: VoiceDraft) {
  if (!d.customer.id && !d.customer.name.trim()) return "Who is this for? Say the customer's name.";
  if (!d.lines.length) return "Add at least one part, labor, or charge.";
  if (d.lines.some((l) => !l.label.trim() || l.quantity <= 0)) return "Every line needs a name and a quantity.";
  if (d.lines.some((l) => l.priceSource === "needs_price" && l.unitPrice <= 0)) return `What's the price for ${d.lines.find((l) => l.priceSource === "needs_price" && l.unitPrice <= 0)?.label ?? "that line"}?`;
  if (voiceDraftTotals(d).subtotal <= 0) return "The total is $0 — what are the prices?";
  return "";
}

function draftCard(draft: VoiceDraft, intent: string) {
  const t = voiceDraftTotals(draft);
  return {
    type: "draft" as const,
    draft,
    intent,
    totals: { subtotal: round(t.subtotal), tax: round(t.tax), discount: round(t.discount), total: round(t.total), down: round(t.down) },
    blocker: draftBlocker(draft),
    canEmail: Boolean(draft.customer.email),
    canText: Boolean(draft.customer.phone),
  };
}

export async function ask(input: AskInput) {
  const message = str(input.message, 4000);
  if (message.length < 2) return { ok: false as const, error: "Say or type what you need." };
  const draft = input.draft && typeof input.draft === "object" && Array.isArray(input.draft.lines) ? input.draft : null;
  const snap = await getSnapshot();
  const data = {
    today: snap.today,
    money: snap.money,
    unpaid: snap.unpaid.map(({ number, customer, total, daysOverdue, reminders }) => ({ number, customer, total, daysOverdue, reminders })),
    quotesWaitingOnCustomer: snap.quotes.map(({ number, customer, total }) => ({ number, customer, total })),
    next7Days: snap.upcoming,
    trackRecord: snap.record,
    recentChangeRequests: snap.changes.slice(0, 5).map((c) => ({ request: c.request, status: c.status })),
  };
  const history = (Array.isArray(input.history) ? input.history : []).slice(-8).map((m) => ({ role: m.role === "assistant" ? "assistant" as const : "user" as const, content: str(m.content, 1500) })).filter((m) => m.content);
  const routed = await askAI({
    system: ROUTER,
    messages: [...history, { role: "user", content: `DATA:\n${JSON.stringify(data)}\n\nDRAFT IS OPEN: ${draft ? `yes (${draft.documentType} for ${draft.customer.name || "unknown customer"})` : "no"}\n\nBRAE SAID:\n"""${message}"""` }],
    maxTokens: 900,
    timeoutMs: 40000,
    reasoningEffort: "low",
  });
  if (!routed.ok) return { ok: false as const, error: routed.error };
  const r = extractJson(routed.text) ?? { kind: "answer", reply: routed.text };
  const kind = ["answer", "document", "reminder", "app_change"].includes(String(r.kind)) ? String(r.kind) : "answer";
  const reply = str(r.reply, 2000);

  if (kind === "document") {
    const type = r.documentType === "invoice" || r.documentType === "quote" ? r.documentType : draft?.documentType ?? "invoice";
    const built = await buildVoiceDraft({ transcript: message, documentType: type, previous: draft });
    if (!built.ok) return { ok: false as const, error: built.error };
    if (built.intent === "cancel") return { ok: true as const, reply: "Okay, I dropped that draft.", card: { type: "cleared" as const } };
    return { ok: true as const, reply: built.reply, card: draftCard(built.draft, built.intent) };
  }

  if (kind === "reminder") {
    const wanted = str(r.invoiceNumber, 40).toUpperCase().replace(/\s+/g, "");
    const inv = snap.unpaid.find((u) => u.number.toUpperCase().replace(/\s+/g, "") === wanted)
      ?? snap.unpaid.find((u) => message.toLowerCase().includes(u.customer.toLowerCase().split(" ")[0] ?? "~~"));
    if (!inv) return { ok: true as const, reply: "I couldn't match that to an unpaid invoice. Which invoice number?", card: null };
    return { ok: true as const, reply: reply || `Send a payment reminder for ${inv.number}?`, card: { type: "reminder" as const, invoice: inv } };
  }

  if (kind === "app_change") {
    const request = str(r.request, 4000) || message;
    return { ok: true as const, reply: reply || "Want me to queue that change for the build?", card: { type: "change" as const, request } };
  }

  await logActivity("question", message.slice(0, 300), { minutesSaved: 2 });
  return { ok: true as const, reply: reply || "I don't have that in the data I can see.", card: null };
}

/* ------------------------------------------------------------------ actions */

function draftToForm(d: VoiceDraft, send: "none" | "email" | "sms") {
  const fd = new FormData();
  fd.set("documentType", d.documentType === "quote" ? "quote" : "invoice");
  fd.set("paymentStatus", "unpaid");
  if (d.customer.id) fd.set("customerId", d.customer.id);
  else { fd.set("customerName", d.customer.name); fd.set("customerAddress", d.customer.address); }
  fd.set("customerEmail", d.customer.email);
  fd.set("customerPhone", d.customer.phone);
  fd.set("jobDescription", d.jobDescription);
  fd.set("jobLocation", d.jobLocation);
  fd.set("workPerformed", d.workPerformed);
  if (d.equipment?.type) {
    fd.set("equipmentType", d.equipment.type);
    fd.set("equipmentManufacturer", d.equipment.manufacturer);
    fd.set("equipmentModel", d.equipment.model);
    fd.set("equipmentSerial", d.equipment.serial);
    fd.set("equipmentRefrigerant", d.equipment.refrigerant);
  }
  d.lines.slice(0, 20).forEach((l, i) => {
    fd.set(`itemPreset${i}`, l.preset || "");
    fd.set(`itemPriceOverride${i}`, "1");
    fd.set(`itemLabel${i}`, l.label);
    fd.set(`itemQty${i}`, String(l.quantity));
    fd.set(`itemPrice${i}`, String(l.unitPrice));
    fd.set(`itemDescription${i}`, l.description || l.partNumber || "");
    if (l.taxable) fd.set(`itemTaxable${i}`, "on");
  });
  fd.set("downPaymentType", d.downPaymentType || "");
  fd.set("downPaymentValue", String(d.downPaymentValue || 0));
  fd.set("paymentTerms", d.paymentTerms || "due_on_receipt");
  fd.set("customDueDate", d.paymentTerms === "custom" ? d.customDueDate : "");
  fd.set("discount", String(d.discount || 0));
  fd.set("taxRate", String(d.taxRate || 0));
  fd.set("notes", d.notes);
  fd.set("autoSend", send);
  return fd;
}

export async function createFromDraft(input: { draft: VoiceDraft; send: string }) {
  const d = input.draft;
  if (!d || !Array.isArray(d.lines) || !d.customer) return { ok: false as const, error: "No draft to create." };
  const send = input.send === "email" || input.send === "sms" ? input.send : "none";
  const blocker = draftBlocker(d);
  if (blocker) return { ok: false as const, error: blocker };
  if (send === "email" && !d.customer.email) return { ok: false as const, error: "No email for this customer. Say their email or text it instead." };
  if (send === "sms" && !d.customer.phone) return { ok: false as const, error: "No phone number for this customer. Say their number or email it instead." };
  try {
    const result = await createDirectDocument(draftToForm(d, send), OWNER);
    const label = result.type === "quote" ? "Quote" : "Invoice";
    const who = d.customer.name || "customer";
    await logActivity(result.type === "quote" ? "quote_created" : "invoice_created", `${label} ${result.number} for ${who} created from the command center`, { amount: result.total, refId: result.id, minutesSaved: 10 });
    if (result.sent?.ok) await logActivity("document_sent", `${label} ${result.number} ${result.sent.channel === "email" ? "emailed" : "texted"} to ${who}`, { refId: result.id, minutesSaved: 3 });
    const sentNote = !result.sent ? "Saved, not sent." : result.sent.ok ? `${result.sent.channel === "email" ? "Emailed" : "Texted"} to ${result.sent.recipient ?? who}.` : `Saved, but not sent: ${result.sent.error}`;
    return { ok: true as const, number: result.number, type: result.type, total: result.total, link: `${APP_URL()}/portal/${result.token}`, sent: result.sent, message: `${label} ${result.number} created for ${who}, $${result.total.toFixed(2)}. ${sentNote}` };
  } catch (error) {
    if (error instanceof DirectDocumentError) return { ok: false as const, error: error.message };
    console.error("[hq] create failed", error);
    return { ok: false as const, error: "Couldn't create it. Nothing was sent." };
  }
}

export async function remind(input: { invoiceId: string; channel: string }) {
  const channel = input.channel === "sms" ? "sms" : "email";
  const id = str(input.invoiceId, 64);
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false as const, error: "Unknown invoice." };
  const result = await sendInvoiceCommunicationAs(OWNER.id, id, channel, true);
  if (!result.ok) return { ok: false as const, error: result.error };
  const { data } = await createServiceRoleClient().from("chillbros_invoices").select("invoice_number").eq("id", id).maybeSingle();
  await logActivity("reminder_sent", `Payment reminder for ${data?.invoice_number ?? "invoice"} ${channel === "email" ? "emailed" : "texted"}`, { refId: id, minutesSaved: 3 });
  return { ok: true as const, message: `Reminder ${channel === "email" ? "emailed" : "texted"} to ${result.data.recipient ?? "the customer"}.` };
}

export async function createChangeRequest(input: { request: string }) {
  const request = str(input.request, 4000);
  if (request.length < 3) return { ok: false as const, error: "Say what you want changed." };
  const { data, error } = await createServiceRoleClient().from("chillbros_hq_change_requests").insert({ request }).select("id,request,status,created_at").single();
  if (error || !data) return { ok: false as const, error: "Couldn't save the request." };
  await logActivity("change_requested", request.slice(0, 300), { refId: data.id });
  return { ok: true as const, change: data, message: "Queued. It gets built and shipped on the next build run, and you'll get a phone alert." };
}

export async function cancelChangeRequest(input: { id: string }) {
  const id = str(input.id, 64);
  const { data } = await createServiceRoleClient().from("chillbros_hq_change_requests").update({ status: "declined", result: "Cancelled by owner.", finished_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", id).eq("status", "pending").select("id").maybeSingle();
  return data ? { ok: true as const, message: "Cancelled." } : { ok: false as const, error: "Only waiting requests can be cancelled." };
}
