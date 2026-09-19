import "server-only";

import { createServiceRoleClient } from "@/lib/neon/data-api/service-client";

export type ServiceAgreementStatus = "draft" | "proposed" | "accepted" | "active" | "cancelled";
export type AgreementCalculationMode = "hourly" | "flat";
export type AgreementDiscountType = "percent" | "dollar" | null;

export type ServiceAgreement = {
  id: string;
  customerId: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  customerAddress: string | null;
  agreementNumber: string;
  portalToken: string;
  title: string;
  status: ServiceAgreementStatus;
  calculationMode: AgreementCalculationMode;
  visitsPerMonth: number;
  hoursPerVisit: number;
  hourlyRate: number;
  monthlyFlatRate: number;
  preferredDays: string[];
  preferredTimeWindow: string | null;
  startDate: string | null;
  endDate: string | null;
  servicesIncluded: string | null;
  customerPreferences: string | null;
  terms: string | null;
  setupFee: number;
  discountType: AgreementDiscountType;
  discountValue: number;
  discountAmount: number;
  monthlySubtotal: number;
  monthlyTotal: number;
  signatureName: string | null;
  signedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type AgreementCustomer = {
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
};

type ServiceAgreementQueryRow = {
  id: string;
  customer_id: string;
  agreement_number: string;
  portal_token: string;
  title: string;
  status: ServiceAgreementStatus;
  calculation_mode: AgreementCalculationMode;
  visits_per_month: number | string;
  hours_per_visit: number | string;
  hourly_rate: number | string;
  monthly_flat_rate: number | string;
  preferred_days: string[] | null;
  preferred_time_window: string | null;
  start_date: string | null;
  end_date: string | null;
  services_included: string | null;
  customer_preferences: string | null;
  terms: string | null;
  setup_fee: number | string;
  discount_type: AgreementDiscountType;
  discount_value: number | string;
  discount_amount: number | string;
  monthly_subtotal: number | string;
  monthly_total: number | string;
  signature_name: string | null;
  signed_at: string | null;
  created_at: string;
  updated_at: string;
  customer: AgreementCustomer | AgreementCustomer[] | null;
};

const map = (row: ServiceAgreementQueryRow): ServiceAgreement => {
  const customer = Array.isArray(row.customer) ? row.customer[0] : row.customer;
  return {
    id: row.id,
    customerId: row.customer_id,
    customerName: customer?.name ?? "Unknown customer",
    customerEmail: customer?.email ?? null,
    customerPhone: customer?.phone ?? null,
    customerAddress: customer?.address ?? null,
    agreementNumber: row.agreement_number,
    portalToken: row.portal_token,
    title: row.title,
    status: row.status,
    calculationMode: row.calculation_mode,
    visitsPerMonth: Number(row.visits_per_month),
    hoursPerVisit: Number(row.hours_per_visit),
    hourlyRate: Number(row.hourly_rate),
    monthlyFlatRate: Number(row.monthly_flat_rate),
    preferredDays: Array.isArray(row.preferred_days) ? row.preferred_days : [],
    preferredTimeWindow: row.preferred_time_window,
    startDate: row.start_date,
    endDate: row.end_date,
    servicesIncluded: row.services_included,
    customerPreferences: row.customer_preferences,
    terms: row.terms,
    setupFee: Number(row.setup_fee),
    discountType: row.discount_type,
    discountValue: Number(row.discount_value),
    discountAmount: Number(row.discount_amount),
    monthlySubtotal: Number(row.monthly_subtotal),
    monthlyTotal: Number(row.monthly_total),
    signatureName: row.signature_name,
    signedAt: row.signed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

const SELECT = "id,customer_id,agreement_number,portal_token,title,status,calculation_mode,visits_per_month,hours_per_visit,hourly_rate,monthly_flat_rate,preferred_days,preferred_time_window,start_date,end_date,services_included,customer_preferences,terms,setup_fee,discount_type,discount_value,discount_amount,monthly_subtotal,monthly_total,signature_name,signed_at,created_at,updated_at,customer:chillbros_customers(name,email,phone,address)";

export async function getServiceAgreements(limit = 250): Promise<ServiceAgreement[]> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.from("chillbros_service_agreements").select(SELECT).order("updated_at", { ascending: false }).limit(limit);
  if (error || !data) return [];
  return (data as unknown as ServiceAgreementQueryRow[]).map(map);
}

export async function getServiceAgreementsByCustomer(customerId: string): Promise<ServiceAgreement[]> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.from("chillbros_service_agreements").select(SELECT).eq("customer_id", customerId).order("updated_at", { ascending: false });
  if (error || !data) return [];
  return (data as unknown as ServiceAgreementQueryRow[]).map(map);
}

export async function getServiceAgreementById(id: string): Promise<ServiceAgreement | null> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.from("chillbros_service_agreements").select(SELECT).eq("id", id).maybeSingle();
  if (error || !data) return null;
  return map(data as unknown as ServiceAgreementQueryRow);
}

export async function getServiceAgreementByToken(token: string): Promise<ServiceAgreement | null> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.from("chillbros_service_agreements").select(SELECT).eq("portal_token", token).neq("status", "cancelled").maybeSingle();
  if (error || !data) return null;
  return map(data as unknown as ServiceAgreementQueryRow);
}
