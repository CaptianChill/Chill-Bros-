"use server";

import { revalidatePath } from "next/cache";
import { simpleDocumentNumber } from "@/lib/chillbros/document-number";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import { createServiceRoleClient } from "@/lib/supabase/service-client";
import type { AgreementCalculationMode, AgreementDiscountType, ServiceAgreementStatus } from "./service-agreement-queries";

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

export type ServiceAgreementInput = {
  id?: string;
  customerId: string;
  title: string;
  calculationMode: AgreementCalculationMode;
  visitsPerMonth: number;
  hoursPerVisit: number;
  hourlyRate: number;
  monthlyFlatRate: number;
  preferredDays: string[];
  preferredTimeWindow?: string;
  startDate?: string;
  endDate?: string;
  servicesIncluded?: string;
  customerPreferences?: string;
  terms?: string;
  setupFee: number;
  discountType: AgreementDiscountType;
  discountValue: number;
};

const DAYS = new Set(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]);
const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const clean = (value: string | undefined, max: number) => { const v = String(value ?? "").trim(); return v ? v.slice(0, max) : null; };

async function requireOfficeOrManager() {
  const profile = await getCurrentStaffProfile();
  if (!profile) return { ok: false as const, error: "Not signed in." };
  if (!["manager", "office"].includes(profile.role)) return { ok: false as const, error: "Office or manager access required." };
  return { ok: true as const, profile };
}

function generateAgreementNumber() { return simpleDocumentNumber("agreement"); }

function refresh(customerId?: string, token?: string) {
  for (const path of ["/agreements", "/office", "/crm", "/manager"]) revalidatePath(path);
  if (customerId) revalidatePath(`/customers/${customerId}`);
  if (token) { revalidatePath(`/agreement/${token}`); revalidatePath(`/agreement/${token}/document`); }
}

function calculateAgreement(input: Pick<ServiceAgreementInput, "calculationMode" | "visitsPerMonth" | "hoursPerVisit" | "hourlyRate" | "monthlyFlatRate" | "discountType" | "discountValue">) {
  const visits = Math.max(1, Math.min(31, Math.floor(Number(input.visitsPerMonth) || 1)));
  const hours = Math.max(0, Math.min(24, Number(input.hoursPerVisit) || 0));
  const hourlyRate = Math.max(0, Number(input.hourlyRate) || 0);
  const flat = Math.max(0, Number(input.monthlyFlatRate) || 0);
  const monthlySubtotal = round(input.calculationMode === "flat" ? flat : visits * hours * hourlyRate);
  const rawDiscount = Math.max(0, Number(input.discountValue) || 0);
  const discountAmount = input.discountType === "percent"
    ? round(Math.min(monthlySubtotal, monthlySubtotal * Math.min(rawDiscount, 100) / 100))
    : input.discountType === "dollar"
      ? round(Math.min(monthlySubtotal, rawDiscount))
      : 0;
  return { monthlySubtotal, discountAmount, monthlyTotal: round(Math.max(0, monthlySubtotal - discountAmount)) };
}

function validate(input: ServiceAgreementInput) {
  const customerId = String(input.customerId ?? "").trim();
  const title = String(input.title ?? "").trim().slice(0, 200);
  if (!customerId) return { ok: false as const, error: "Choose a customer." };
  if (!title) return { ok: false as const, error: "Plan title is required." };
  if (!["hourly", "flat"].includes(input.calculationMode)) return { ok: false as const, error: "Choose a valid pricing method." };
  const visits = Math.floor(Number(input.visitsPerMonth));
  const hours = Number(input.hoursPerVisit);
  const hourlyRate = Number(input.hourlyRate);
  const flatRate = Number(input.monthlyFlatRate);
  const setupFee = Number(input.setupFee);
  const discountValue = Number(input.discountValue);
  if (!Number.isFinite(visits) || visits < 1 || visits > 31) return { ok: false as const, error: "Visits per month must be between 1 and 31." };
  if (!Number.isFinite(hours) || hours < 0 || hours > 24) return { ok: false as const, error: "Hours per visit must be between 0 and 24." };
  if (![hourlyRate, flatRate, setupFee, discountValue].every(Number.isFinite) || [hourlyRate, flatRate, setupFee, discountValue].some((n) => n < 0)) return { ok: false as const, error: "Rates, fees, and discounts must be valid nonnegative numbers." };
  if (input.calculationMode === "hourly" && hourlyRate <= 0) return { ok: false as const, error: "Enter an hourly rate." };
  if (input.calculationMode === "flat" && flatRate <= 0) return { ok: false as const, error: "Enter a monthly flat rate." };
  if (input.startDate && input.endDate && input.endDate < input.startDate) return { ok: false as const, error: "End date cannot be before the start date." };
  const preferredDays = [...new Set((input.preferredDays ?? []).filter((day) => DAYS.has(day)))];
  const pricing = calculateAgreement(input);
  return { ok: true as const, clean: { customerId, title, visits, hours, hourlyRate: round(hourlyRate), flatRate: round(flatRate), setupFee: round(setupFee), discountValue: round(discountValue), preferredDays, ...pricing } };
}

export async function createServiceAgreementAction(input: ServiceAgreementInput): Promise<Result<{ id: string; agreementNumber: string; portalToken: string }>> {
  const guard = await requireOfficeOrManager();
  if (!guard.ok) return guard;
  const valid = validate(input);
  if (!valid.ok) return valid;

  const supabase = createServiceRoleClient();
  const agreementNumber = generateAgreementNumber();
  const c = valid.clean;
  const { data, error } = await supabase.from("chillbros_service_agreements").insert({ customer_id: c.customerId, agreement_number: agreementNumber, title: c.title, status: "proposed", calculation_mode: input.calculationMode, visits_per_month: c.visits, hours_per_visit: c.hours, hourly_rate: c.hourlyRate, monthly_flat_rate: c.flatRate, preferred_days: c.preferredDays, preferred_time_window: clean(input.preferredTimeWindow, 300), start_date: input.startDate || null, end_date: input.endDate || null, services_included: clean(input.servicesIncluded, 8000), customer_preferences: clean(input.customerPreferences, 6000), terms: clean(input.terms, 8000), setup_fee: c.setupFee, discount_type: input.discountType, discount_value: c.discountValue, discount_amount: c.discountAmount, monthly_subtotal: c.monthlySubtotal, monthly_total: c.monthlyTotal, created_by: guard.profile.id }).select("id,agreement_number,portal_token").single();
  if (error || !data) return { ok: false, error: error?.message ?? "Could not create the service agreement." };
  await supabase.from("chillbros_customer_service_history").insert({ customer_id: c.customerId, note: `Monthly service plan ${data.agreement_number} created for customer review.` });
  refresh(c.customerId, data.portal_token);
  return { ok: true, data: { id: data.id, agreementNumber: data.agreement_number, portalToken: data.portal_token } };
}

export async function updateServiceAgreementAction(input: ServiceAgreementInput & { id: string }): Promise<Result> {
  const guard = await requireOfficeOrManager();
  if (!guard.ok) return guard;
  const valid = validate(input);
  if (!valid.ok) return valid;
  const supabase = createServiceRoleClient();
  const { data: existing } = await supabase.from("chillbros_service_agreements").select("customer_id,portal_token,status").eq("id", input.id).maybeSingle();
  if (!existing) return { ok: false, error: "Service agreement not found." };
  const c = valid.clean;
  const signatureMustReset = ["accepted", "active"].includes(existing.status);
  const updates: Record<string, unknown> = { customer_id: c.customerId, title: c.title, status: signatureMustReset ? "proposed" : existing.status, calculation_mode: input.calculationMode, visits_per_month: c.visits, hours_per_visit: c.hours, hourly_rate: c.hourlyRate, monthly_flat_rate: c.flatRate, preferred_days: c.preferredDays, preferred_time_window: clean(input.preferredTimeWindow, 300), start_date: input.startDate || null, end_date: input.endDate || null, services_included: clean(input.servicesIncluded, 8000), customer_preferences: clean(input.customerPreferences, 6000), terms: clean(input.terms, 8000), setup_fee: c.setupFee, discount_type: input.discountType, discount_value: c.discountValue, discount_amount: c.discountAmount, monthly_subtotal: c.monthlySubtotal, monthly_total: c.monthlyTotal, updated_at: new Date().toISOString() };
  if (signatureMustReset) { updates.signature_name = null; updates.signed_at = null; }
  const { error } = await supabase.from("chillbros_service_agreements").update(updates).eq("id", input.id);
  if (error) return { ok: false, error: error.message };
  refresh(c.customerId, existing.portal_token);
  if (existing.customer_id !== c.customerId) refresh(existing.customer_id);
  return { ok: true, data: undefined };
}

export async function setServiceAgreementStatusAction(id: string, status: Extract<ServiceAgreementStatus, "proposed" | "active" | "cancelled">): Promise<Result> {
  const guard = await requireOfficeOrManager();
  if (!guard.ok) return guard;
  if (!["proposed", "active", "cancelled"].includes(status)) return { ok: false, error: "Invalid agreement status." };
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.from("chillbros_service_agreements").update({ status, updated_at: new Date().toISOString() }).eq("id", id).select("customer_id,portal_token").maybeSingle();
  if (error || !data) return { ok: false, error: error?.message ?? "Agreement not found." };
  refresh(data.customer_id, data.portal_token);
  return { ok: true, data: undefined };
}

export async function acceptServiceAgreementAction(token: string, signatureName: string): Promise<Result> {
  const name = String(signatureName ?? "").trim();
  if (name.length < 2) return { ok: false, error: "Type your name to accept the agreement." };
  const supabase = createServiceRoleClient();
  const signedAt = new Date().toISOString();
  const { data, error } = await supabase.from("chillbros_service_agreements").update({ status: "accepted", signature_name: name.slice(0, 200), signed_at: signedAt, updated_at: signedAt }).eq("portal_token", token).in("status", ["draft", "proposed"]).select("customer_id,agreement_number").maybeSingle();
  if (error || !data) return { ok: false, error: error?.message ?? "This agreement is no longer available for acceptance." };
  await supabase.from("chillbros_customer_service_history").insert({ customer_id: data.customer_id, note: `Customer accepted monthly service agreement ${data.agreement_number}.` });
  refresh(data.customer_id, token);
  return { ok: true, data: undefined };
}
