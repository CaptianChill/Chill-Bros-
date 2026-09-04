"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";

import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import { createServiceRoleClient } from "@/lib/supabase/service-client";
import type { AdjustmentType, PaymentMethod } from "./types";

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };
export type EstimateDraftLine = { label: string; description?: string; quantity: number; unitPrice: number };
export type EstimateAdjustments = { discountType: AdjustmentType | null; discountValue: number; downPaymentType: AdjustmentType | null; downPaymentValue: number };
type EstimateRpcRow = { estimate_id: string; estimate_number: string; estimate_token: string };

function estimateNumber() {
  const now = new Date();
  return `EST-${now.toISOString().slice(0,10).replace(/-/g,"")}-${now.toISOString().slice(11,19).replace(/:/g,"")}-${randomBytes(2).toString("hex").toUpperCase()}`;
}

function validateLines(lines: EstimateDraftLine[]) {
  if (!Array.isArray(lines) || lines.length < 1 || lines.length > 20) return { ok: false as const, error: "Add between 1 and 20 line items." };
  const clean = [] as EstimateDraftLine[];
  let subtotal = 0;
  for (const row of lines) {
    const label = String(row.label ?? "").trim();
    const description = String(row.description ?? "").trim();
    const quantity = Number(row.quantity);
    const unitPrice = Number(row.unitPrice);
    if (!label || label.length > 200 || description.length > 1000 || !Number.isFinite(quantity) || quantity <= 0 || quantity > 1000 || !Number.isFinite(unitPrice) || unitPrice < 0 || unitPrice > 100000) return { ok: false as const, error: "Check line item name, description, quantity, and unit price." };
    const amount = Math.round(quantity * unitPrice * 100) / 100;
    subtotal += amount;
    clean.push({ label, description, quantity, unitPrice });
  }
  if (subtotal <= 0 || subtotal > 250000) return { ok: false as const, error: "Estimate subtotal must be between $0.01 and $250,000." };
  return { ok: true as const, lines: clean, subtotal };
}

function calcAdjustments(subtotal: number, input: EstimateAdjustments) {
  const discountValue = Math.max(0, Number(input.discountValue || 0));
  const downPaymentValue = Math.max(0, Number(input.downPaymentValue || 0));
  if (input.discountType === "percent" && discountValue > 100) return { ok: false as const, error: "Discount percentage cannot exceed 100%." };
  if (input.downPaymentType === "percent" && downPaymentValue > 100) return { ok: false as const, error: "Down payment percentage cannot exceed 100%." };
  const discountAmount = input.discountType === "percent" ? subtotal * discountValue / 100 : input.discountType === "dollar" ? Math.min(discountValue, subtotal) : 0;
  const total = Math.max(0, subtotal - discountAmount);
  const downPaymentAmount = input.downPaymentType === "percent" ? total * downPaymentValue / 100 : input.downPaymentType === "dollar" ? Math.min(downPaymentValue, total) : 0;
  return { ok: true as const, discountAmount: Math.round(discountAmount * 100) / 100, downPaymentAmount: Math.round(downPaymentAmount * 100) / 100, total };
}

async function canEditEstimateJob(jobId: string) {
  const profile = await getCurrentStaffProfile();
  if (!profile) return { ok: false as const, error: "Not signed in." };
  if (profile.role === "manager") return { ok: true as const, profile };
  const supabase = createServiceRoleClient();
  const { data } = await supabase.from("chillbros_jobs").select("id").eq("id", jobId).eq("assigned_tech_id", profile.id).in("status", ["scheduled","in_progress"]).maybeSingle();
  if (!data) return { ok: false as const, error: "This job is not assigned to you." };
  return { ok: true as const, profile };
}

export async function createEstimateV2Action(jobId: string, lines: EstimateDraftLine[], notes: string, adjustments: EstimateAdjustments): Promise<Result<{ estimateId: string; estimateNumber: string; portalToken: string }>> {
  const allowed = await canEditEstimateJob(jobId); if (!allowed.ok) return allowed;
  const checked = validateLines(lines); if (!checked.ok) return checked;
  const cleanNotes = String(notes ?? "").trim(); if (cleanNotes.length > 2000) return { ok: false, error: "Customer notes must be 2,000 characters or fewer." };
  const calc = calcAdjustments(checked.subtotal, adjustments); if (!calc.ok) return calc;
  const supabase = createServiceRoleClient();
  const number = estimateNumber();
  const { data, error } = await supabase.rpc("chillbros_create_estimate_v2", {
    p_job_id: jobId,
    p_invoice_number: number,
    p_notes: cleanNotes || null,
    p_line_items: checked.lines.map((line) => ({ label: line.label, description: line.description || null, quantity: line.quantity, unit_price: line.unitPrice })),
    p_adjustments: { discount_type: adjustments.discountType, discount_value: Number(adjustments.discountValue || 0), down_payment_type: adjustments.downPaymentType, down_payment_value: Number(adjustments.downPaymentValue || 0) },
  }).single();
  if (error || !data) return { ok: false, error: error?.code === "23505" ? "This job already has an active estimate." : error?.message ?? "Could not create estimate." };
  const row = data as unknown as EstimateRpcRow;
  await supabase.from("chillbros_workflow_events").insert({ job_id: jobId, invoice_id: row.estimate_id, actor_id: allowed.profile.id, stage: "estimate_published", message: "Estimate published. Customer approval is the next step." });
  ["/technician","/manager","/dispatch","/"].forEach(revalidatePath);
  return { ok: true, data: { estimateId: row.estimate_id, estimateNumber: row.estimate_number, portalToken: row.estimate_token } };
}

export async function updateEstimateAdjustmentsAction(invoiceId: string, adjustments: EstimateAdjustments): Promise<Result> {
  const profile = await getCurrentStaffProfile(); if (!profile) return { ok: false, error: "Not signed in." };
  const supabase = createServiceRoleClient();
  const { data: invoice } = await supabase.from("chillbros_invoices").select("id,job_id,status,revoked_at,portal_token").eq("id", invoiceId).maybeSingle();
  if (!invoice || invoice.revoked_at || invoice.status === "void") return { ok: false, error: "Estimate is not active." };
  if (invoice.status === "approved") return { ok: false, error: "Approved estimates are locked. Create a replacement if pricing must change." };
  if (profile.role === "technician") {
    const { data: job } = await supabase.from("chillbros_jobs").select("id").eq("id", invoice.job_id).eq("assigned_tech_id", profile.id).maybeSingle();
    if (!job) return { ok: false, error: "This estimate is not on your assigned job." };
  }
  const { data: rows } = await supabase.from("chillbros_invoice_line_items").select("amount").eq("invoice_id", invoiceId);
  const subtotal = (rows ?? []).reduce((sum, r) => sum + Number(r.amount), 0);
  const calc = calcAdjustments(subtotal, adjustments); if (!calc.ok) return calc;
  const { error } = await supabase.from("chillbros_invoices").update({ discount_type: adjustments.discountType, discount_value: Number(adjustments.discountValue || 0), discount_amount: calc.discountAmount, down_payment_type: adjustments.downPaymentType, down_payment_value: Number(adjustments.downPaymentValue || 0), down_payment_amount: calc.downPaymentAmount, updated_at: new Date().toISOString() }).eq("id", invoiceId);
  if (error) return { ok: false, error: error.message };
  await supabase.from("chillbros_workflow_events").insert({ job_id: invoice.job_id, invoice_id: invoiceId, actor_id: profile.id, stage: "pricing_updated", message: "Discount/down-payment terms updated." });
  ["/technician","/manager","/dispatch",`/portal/${invoice.portal_token}`].forEach(revalidatePath);
  return { ok: true, data: undefined };
}

async function activeInvoiceByToken(token: string) {
  const supabase = createServiceRoleClient();
  const { data } = await supabase.from("chillbros_invoices").select("id,job_id,status,payment_status,revoked_at").eq("portal_token", token).is("revoked_at", null).neq("status","void").maybeSingle();
  return data ?? null;
}

export async function approveInvoiceV2Action(token: string, signatureName: string): Promise<Result> {
  const name = signatureName.trim(); if (name.length < 2) return { ok: false, error: "Type your name to approve." };
  const invoice = await activeInvoiceByToken(token); if (!invoice) return { ok: false, error: "This secure link is no longer active." };
  if (invoice.status === "approved") return { ok: true, data: undefined };
  if (invoice.status !== "awaiting_approval") return { ok: false, error: "This estimate cannot be approved right now." };
  const supabase = createServiceRoleClient(); const now = new Date().toISOString();
  const { data, error } = await supabase.from("chillbros_invoices").update({ status: "approved", signature_name: name, signed_at: now, updated_at: now }).eq("id", invoice.id).eq("status","awaiting_approval").select("id").maybeSingle();
  if (error || !data) return { ok: false, error: error?.message ?? "Approval could not be recorded." };
  await supabase.from("chillbros_workflow_events").insert({ job_id: invoice.job_id, invoice_id: invoice.id, stage: "approved", message: `Customer approved estimate as ${name}.` });
  await supabase.from("chillbros_email_log").insert({ subject: "Customer approval received", recipients: "manager + dispatch", related_invoice_id: invoice.id, status: "queued" });
  ["/manager","/dispatch","/technician","/",`/portal/${token}`].forEach(revalidatePath);
  return { ok: true, data: undefined };
}

export async function setInvoicePaymentMethodV2Action(token: string, method: PaymentMethod): Promise<Result> {
  const invoice = await activeInvoiceByToken(token); if (!invoice) return { ok: false, error: "This secure link is no longer active." };
  if (invoice.payment_status === "paid") return { ok: false, error: "Payment is already recorded." };
  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("chillbros_invoices").update({ payment_method: method, payment_status: "pending_manual_review", updated_at: new Date().toISOString() }).eq("id", invoice.id);
  if (error) return { ok: false, error: error.message };
  await supabase.from("chillbros_workflow_events").insert({ job_id: invoice.job_id, invoice_id: invoice.id, stage: "payment_method_selected", message: `Customer selected ${method.replace(/_/g," ")} for payment.` });
  ["/manager","/dispatch",`/portal/${token}`].forEach(revalidatePath);
  return { ok: true, data: undefined };
}

export async function markInvoicePaidV2Action(invoiceId: string): Promise<Result> {
  const profile = await getCurrentStaffProfile(); if (!profile || profile.role !== "manager") return { ok: false, error: "Manager access required." };
  const supabase = createServiceRoleClient(); const now = new Date().toISOString();
  const { data, error } = await supabase.from("chillbros_invoices").update({ payment_status: "paid", paid_at: now, paid_recorded_by: profile.id, updated_at: now }).eq("id", invoiceId).eq("status","approved").is("revoked_at",null).neq("payment_status","paid").select("id,job_id,portal_token").maybeSingle();
  if (error || !data) return { ok: false, error: error?.message ?? "Only an approved active invoice can be marked paid." };
  await supabase.from("chillbros_workflow_events").insert({ job_id: data.job_id, invoice_id: invoiceId, actor_id: profile.id, stage: "paid", message: "Manager recorded payment. Billing workflow complete." });
  ["/manager","/dispatch","/technician","/crm","/",`/portal/${data.portal_token}`].forEach(revalidatePath);
  return { ok: true, data: undefined };
}
