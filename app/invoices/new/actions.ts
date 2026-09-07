"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createReceiptForPaidInvoice } from "@/lib/chillbros/billing-receipts";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import { createServiceRoleClient } from "@/lib/supabase/service-client";

const PAYMENT_METHODS = new Set(["cash", "check", "ach", "cash_app", "venmo", "zelle", "apple_pay", "card"]);
const PAYMENT_TERMS = new Set(["due_on_receipt", "net_7", "net_15", "net_30", "custom"]);
type DocumentType = "quote" | "invoice";

function text(fd: FormData, key: string) { return String(fd.get(key) ?? "").trim(); }
function money(fd: FormData, key: string) { const n = Number(text(fd, key) || 0); return Number.isFinite(n) ? n : 0; }
function documentNumber(type: DocumentType) {
  const now = new Date();
  const prefix = type === "quote" ? "QUO" : "INV";
  return `${prefix}-${now.toISOString().slice(0,10).replace(/-/g,"")}-${now.toISOString().slice(11,19).replace(/:/g,"")}-${randomBytes(2).toString("hex").toUpperCase()}`;
}
function dueAt(terms: string, custom: string) {
  if (terms === "custom" && custom) { const d = new Date(`${custom}T23:59:59`); return Number.isNaN(d.getTime()) ? null : d.toISOString(); }
  const days = terms === "net_7" ? 7 : terms === "net_15" ? 15 : terms === "net_30" ? 30 : 0;
  const d = new Date(); d.setDate(d.getDate() + days); return d.toISOString();
}
function fail(message: string, type: DocumentType): never { redirect(`/invoices/new?type=${type}&error=${encodeURIComponent(message)}`); }

export async function createDirectInvoiceAction(formData: FormData): Promise<never> {
  const profile = await getCurrentStaffProfile();
  if (!profile || profile.role !== "manager") redirect("/sign-in");
  const type: DocumentType = text(formData, "documentType") === "quote" ? "quote" : "invoice";
  const supabase = createServiceRoleClient();

  let customerId = text(formData, "customerId");
  if (!customerId) {
    const name = text(formData, "customerName");
    const email = text(formData, "customerEmail").toLowerCase();
    if (!name) fail("Choose an existing customer or enter a new customer name.", type);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail("Enter a valid customer email.", type);
    const { data: customer, error } = await supabase.from("chillbros_customers").insert({
      name: name.slice(0,200), phone: text(formData,"customerPhone").slice(0,50) || null,
      email: email || null, address: text(formData,"customerAddress").slice(0,500) || null, created_by: profile.id,
    }).select("id").single();
    if (error || !customer) fail(error?.message ?? "Could not create customer.", type);
    customerId = customer.id;
  } else {
    const { data: customer } = await supabase.from("chillbros_customers").select("id").eq("id", customerId).maybeSingle();
    if (!customer) fail("Customer record not found.", type);
  }

  const [{ data: catalogRows }, { data: feeRows }] = await Promise.all([
    supabase.from("chillbros_parts_catalog").select("id,name,part_number,retail_price"),
    supabase.from("chillbros_fee_settings").select("id,label,amount"),
  ]);
  const catalog = new Map((catalogRows ?? []).map((row) => [String(row.id), row]));
  const priceBook = new Map((catalogRows ?? []).filter((row) => String(row.part_number ?? "").startsWith("PB-")).map((row) => [String(row.part_number), row]));
  const fees = new Map((feeRows ?? []).map((row) => [String(row.id), row]));

  const lines = Array.from({ length: 8 }, (_, i) => {
    const preset = text(formData, `itemPreset${i}`);
    let presetLabel = "";
    let presetDescription = "";
    let presetPrice: number | null = null;
    if (preset.startsWith("part:")) {
      const row = catalog.get(preset.slice(5));
      if (row && !String(row.part_number ?? "").startsWith("PB-")) { presetLabel = row.name; presetDescription = row.part_number || "Inventory part"; presetPrice = Number(row.retail_price ?? 0); }
    } else if (preset.startsWith("fee:")) {
      const row = fees.get(preset.slice(4));
      if (row) { presetLabel = row.label; presetDescription = "Service fee"; presetPrice = Number(row.amount ?? 0); }
    } else if (preset.startsWith("pb:")) {
      const row = priceBook.get(preset.slice(3));
      if (row) { presetLabel = row.name; presetDescription = row.part_number || "Price book"; presetPrice = Number(row.retail_price ?? 0); }
    }
    return {
      label: presetLabel || text(formData, `itemLabel${i}`),
      description: text(formData, `itemDescription${i}`) || presetDescription,
      quantity: money(formData, `itemQty${i}`),
      unit_price: presetPrice ?? money(formData, `itemPrice${i}`),
      taxable: formData.get(`itemTaxable${i}`) === "on",
    };
  }).filter((row) => row.label);
  if (!lines.length) fail(`Add at least one ${type} line item.`, type);
  for (const row of lines) if (row.quantity <= 0 || row.unit_price < 0 || row.label.length > 200) fail("Check each line item, quantity, and price.", type);

  const subtotal = lines.reduce((sum, row) => sum + row.quantity * row.unit_price, 0);
  if (subtotal <= 0 || subtotal > 250000) fail(`${type === "quote" ? "Quote" : "Invoice"} subtotal must be between $0.01 and $250,000.`, type);
  const discount = Math.max(0, Math.min(money(formData, "discount"), subtotal));
  const taxRate = Math.max(0, Math.min(money(formData, "taxRate"), 25));
  const taxableSubtotal = lines.filter((row) => row.taxable).reduce((sum, row) => sum + row.quantity * row.unit_price, 0);
  const taxableAfterDiscount = subtotal > 0 ? Math.max(0, taxableSubtotal - discount * (taxableSubtotal / subtotal)) : 0;
  const taxAmount = Math.round(taxableAfterDiscount * taxRate) / 100;

  // The estimate RPC still requires a job_id. For standalone owner billing we create a closed
  // administrative record automatically; it never appears as an open/scheduled service call.
  const jobLocation = text(formData, "jobLocation") || text(formData, "customerAddress") || null;
  const scope = text(formData, "jobDescription") || `Standalone ${type}`;
  const now = new Date().toISOString();
  const { data: job, error: jobError } = await supabase.from("chillbros_jobs").insert({
    customer_id: customerId, assigned_tech_id: profile.id, status: "completed", location: jobLocation,
    scope: scope.slice(0,4000), work_performed: text(formData,"workPerformed").slice(0,4000) || null,
    scheduled_window: `Standalone ${type} · no service call required`,
  }).select("id").single();
  if (jobError || !job) fail(jobError?.message ?? `Could not create standalone ${type}.`, type);

  const number = documentNumber(type);
  const { data: created, error: createError } = await supabase.rpc("chillbros_create_estimate_v2", {
    p_job_id: job.id,
    p_invoice_number: number,
    p_notes: text(formData,"notes").slice(0,2000) || null,
    p_line_items: lines,
    p_adjustments: { discount_type: discount > 0 ? "dollar" : null, discount_value: discount, down_payment_type: null, down_payment_value: 0, tax_rate: taxRate },
  }).single();
  if (createError || !created) fail(createError?.message ?? `Could not create ${type}.`, type);

  const invoice = created as { estimate_id: string; estimate_number: string; estimate_token: string };
  const terms = PAYMENT_TERMS.has(text(formData,"paymentTerms")) ? text(formData,"paymentTerms") : "due_on_receipt";
  const method = PAYMENT_METHODS.has(text(formData,"paymentMethod")) ? text(formData,"paymentMethod") : null;
  const isPaid = type === "invoice" && text(formData,"paymentStatus") === "paid";
  if (isPaid && !method) fail("Choose a payment method when marking an invoice paid.", type);
  const computedDueAt = type === "invoice" ? dueAt(terms, text(formData,"customDueDate")) : null;

  const { error: issueError } = await supabase.from("chillbros_invoices").update({
    status: type === "quote" ? "awaiting_approval" : "approved",
    issued_at: type === "invoice" ? now : null,
    due_at: computedDueAt,
    payment_terms: terms,
    payment_method: type === "invoice" ? method : null,
    payment_status: isPaid ? "paid" : "unpaid",
    paid_at: isPaid ? now : null,
    paid_recorded_by: isPaid ? profile.id : null,
    taxable_subtotal: taxableSubtotal, tax_amount: taxAmount, updated_at: now,
  }).eq("id", invoice.estimate_id);
  if (issueError) fail(issueError.message, type);

  await supabase.from("chillbros_workflow_events").insert({
    job_id: job.id, invoice_id: invoice.estimate_id, actor_id: profile.id,
    stage: type === "quote" ? "estimate_created" : "invoice_issued",
    message: `${type === "quote" ? "Quote" : "Invoice"} created directly by owner/manager without requiring an open service call.`,
  });
  await supabase.from("chillbros_customer_service_history").insert({ customer_id: customerId, note: `${type === "quote" ? "Quote" : "Invoice"} ${number} created by owner.` });

  if (isPaid) {
    try {
      const receipt = await createReceiptForPaidInvoice(invoice.estimate_id, profile.id);
      await supabase.from("chillbros_receipts").update({
        payment_reference: text(formData,"paymentReference").slice(0,120) || null,
        payer_name: text(formData,"payerName").slice(0,160) || null,
        card_last4: method === "card" ? text(formData,"cardLast4").slice(0,4) || null : null,
        payment_notes: text(formData,"paymentNotes").slice(0,1000) || null,
      }).eq("id", receipt.id);
    } catch { /* invoice remains paid even if receipt generation needs retry */ }
  }

  for (const path of ["/create","/invoices/new","/invoices","/payments","/reports","/customers","/dispatch","/"]) revalidatePath(path);
  redirect(`/invoices/new?type=${type}&success=${encodeURIComponent(`${number} created successfully.`)}&token=${encodeURIComponent(invoice.estimate_token)}&invoice=${encodeURIComponent(number)}`);
}
