import "server-only";

import { createServiceRoleClient } from "@/lib/neon/data-api/service-client";
import { PRICE_BOOK_SEED } from "./price-book";
import type {
  Customer,
  EmailLogEntry,
  FeeSetting,
  Invoice,
  Job,
  PartsCatalogItem,
  PriceBookEntry,
  StaffAccount,
} from "./types";

export async function getStaffAccounts(): Promise<StaffAccount[]> {
  const supabase = createServiceRoleClient();
  const { data: profiles, error } = await supabase.from("chillbros_profiles").select("id, full_name, email, role, status, phone, last_clock_event").order("created_at", { ascending: true });
  if (error) throw new Error(`Could not load staff accounts: ${error.message}`);
  if (!profiles) return [];
  const { data: jobCounts } = await supabase.from("chillbros_jobs").select("assigned_tech_id").in("status", ["scheduled", "in_progress"]);
  const countByTech = new Map<string, number>();
  for (const job of jobCounts ?? []) { if (!job.assigned_tech_id) continue; countByTech.set(job.assigned_tech_id, (countByTech.get(job.assigned_tech_id) ?? 0) + 1); }
  return profiles.filter(profile => !String(profile.email).endsWith("@removed.invalid")).map((profile) => ({ id: profile.id, fullName: profile.full_name, email: profile.email, role: profile.role, status: profile.status, phone: profile.phone, lastClockEvent: profile.last_clock_event, assignedJobs: countByTech.get(profile.id) ?? 0 }));
}

function customerKey(name: string) { return String(name ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }

export async function getCustomers(): Promise<Customer[]> {
  const supabase = createServiceRoleClient();
  const { data: customers, error } = await supabase.from("chillbros_customers").select("id, name, address, phone, email").order("created_at", { ascending: false });
  if (error || !customers) return [];
  const { data: history } = await supabase.from("chillbros_customer_service_history").select("customer_id, note, occurred_on").order("occurred_on", { ascending: false });
  const historyByCustomer = new Map<string, string[]>();
  for (const entry of history ?? []) { const list = historyByCustomer.get(entry.customer_id) ?? []; list.push(entry.note); historyByCustomer.set(entry.customer_id, list); }
  const mapped = customers.map((customer) => ({ id: customer.id, name: customer.name, address: customer.address, phone: customer.phone, email: customer.email, history: historyByCustomer.get(customer.id) ?? [] }));
  const unique = new Map<string, Customer>();
  for (const customer of mapped) {
    const key = customerKey(customer.name) || customer.id;
    const current = unique.get(key);
    if (!current) { unique.set(key, customer); continue; }
    current.address ||= customer.address;
    current.phone ||= customer.phone;
    current.email ||= customer.email;
    current.history = Array.from(new Set([...current.history, ...customer.history]));
  }
  return Array.from(unique.values());
}

export async function getPartsCatalog(): Promise<PartsCatalogItem[]> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.from("chillbros_parts_catalog").select("id, name, part_number, default_cost, retail_price, stock").order("name", { ascending: true });
  if (error || !data) return [];
  return data.filter((part) => !String(part.part_number ?? "").startsWith("PB-")).map((part) => ({ id: part.id, name: part.name, partNumber: part.part_number, defaultCost: Number(part.default_cost), retailPrice: Number(part.retail_price), stock: part.stock }));
}

export async function getPriceBookEntries(): Promise<PriceBookEntry[]> {
  const supabase = createServiceRoleClient();
  const { data: existingRows } = await supabase.from("chillbros_parts_catalog").select("part_number, name, retail_price").like("part_number", "PB-%");
  const existingCodes = new Set((existingRows ?? []).map((row) => String(row.part_number)));
  const missing = PRICE_BOOK_SEED.filter((item) => !existingCodes.has(item.code));
  if (missing.length > 0) {
    await supabase.from("chillbros_parts_catalog").insert(missing.map((item) => ({ name: item.description.slice(0, 200), part_number: item.code, default_cost: item.defaultValue, retail_price: item.defaultValue, stock: 0 })));
  }
  const { data: storedRows } = await supabase.from("chillbros_parts_catalog").select("part_number, name, retail_price").like("part_number", "PB-%");
  type StoredPriceBookRow = { part_number: string; name: string; retail_price: number };
  const stored = (storedRows ?? existingRows ?? []) as StoredPriceBookRow[];
  const storedByCode = new Map<string, StoredPriceBookRow>(stored.map((row) => [String(row.part_number), row]));
  return PRICE_BOOK_SEED.map((seed) => { const row = storedByCode.get(seed.code); return { code: seed.code, category: seed.category, categoryKey: seed.categoryKey, title: seed.title, marketPrice: seed.marketPrice, currentValue: Number(row?.retail_price ?? seed.defaultValue), description: String(row?.name ?? seed.description), kind: seed.kind }; });
}

export async function getFeeSettings(): Promise<FeeSetting[]> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.from("chillbros_fee_settings").select("id, label, amount").order("sort_order", { ascending: true });
  if (error || !data) return [];
  return data.map((fee) => ({ id: fee.id, label: fee.label, amount: Number(fee.amount) }));
}

export async function getEmailLog(limit = 20): Promise<EmailLogEntry[]> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.from("chillbros_email_log").select("id, subject, recipients, status, created_at").order("created_at", { ascending: false }).limit(limit);
  if (error || !data) return [];
  return data.map((entry) => ({ id: entry.id, subject: entry.subject, recipients: entry.recipients, status: entry.status, createdAt: entry.created_at }));
}

export async function getJob(jobId: string): Promise<Job | null> {
  const supabase = createServiceRoleClient();
  const { data: job, error } = await supabase.from("chillbros_jobs").select("id, customer_id, assigned_tech_id, status, location, scope, work_performed, labor_hours, drive_hours, scheduled_window, customer:chillbros_customers(name), tech:chillbros_profiles(full_name)").eq("id", jobId).maybeSingle();
  if (error || !job) return null;
  const [{ data: partsRows }, { data: photoRows }] = await Promise.all([
    supabase.from("chillbros_job_parts").select("id, quantity, part:chillbros_parts_catalog(id, name, part_number, retail_price)").eq("job_id", jobId),
    supabase.from("chillbros_job_photos").select("id, phase, storage_path, caption").eq("job_id", jobId),
  ]);
  const signedUrlByPath = new Map<string, string>();
  if (photoRows && photoRows.length > 0) { const { data: signed } = await supabase.storage.from("chillbros-media").createSignedUrls(photoRows.map((p) => p.storage_path), 3600); for (const entry of signed ?? []) if (entry.signedUrl && entry.path) signedUrlByPath.set(entry.path, entry.signedUrl); }
  const customer = Array.isArray(job.customer) ? job.customer[0] : job.customer;
  const tech = Array.isArray(job.tech) ? job.tech[0] : job.tech;
  return { id: job.id, customerId: job.customer_id, customerName: customer?.name ?? "Unknown customer", assignedTechId: job.assigned_tech_id, assignedTechName: tech?.full_name ?? null, status: job.status, location: job.location, scope: job.scope, workPerformed: job.work_performed, laborHours: Number(job.labor_hours), driveHours: Number(job.drive_hours), scheduledWindow: job.scheduled_window, parts: (partsRows ?? []).map((row) => { const part = Array.isArray(row.part) ? row.part[0] : row.part; return { id: row.id, name: part?.name ?? "Unknown part", partNumber: part?.part_number ?? "", retailPrice: Number(part?.retail_price ?? 0), quantity: row.quantity }; }), beforePhotos: (photoRows ?? []).filter((p) => p.phase === "before").map((p) => ({ id: p.id, storagePath: p.storage_path, caption: p.caption, url: signedUrlByPath.get(p.storage_path) ?? null })), afterPhotos: (photoRows ?? []).filter((p) => p.phase === "after").map((p) => ({ id: p.id, storagePath: p.storage_path, caption: p.caption, url: signedUrlByPath.get(p.storage_path) ?? null })) };
}

export async function getActiveJobForTech(techId: string): Promise<Job | null> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.from("chillbros_jobs").select("id").eq("assigned_tech_id", techId).in("status", ["scheduled", "in_progress"]).order("created_at", { ascending: true }).limit(1).maybeSingle();
  if (error || !data) return null;
  return getJob(data.id);
}

export async function getInvoiceByToken(token: string): Promise<Invoice | null> {
  const supabase = createServiceRoleClient();
  const { data: invoice, error } = await supabase.from("chillbros_invoices").select("id, invoice_number, portal_token, status, customer_id, job_id, signature_name, signed_at, payment_method, payment_status, notes, customer:chillbros_customers(name)").eq("portal_token", token).is("revoked_at", null).neq("status", "void").maybeSingle();
  if (error || !invoice) return null;
  const { data: lineItems } = await supabase.from("chillbros_invoice_line_items").select("id, label, amount").eq("invoice_id", invoice.id).order("sort_order", { ascending: true });
  const customer = Array.isArray(invoice.customer) ? invoice.customer[0] : invoice.customer;
  return { id: invoice.id, invoiceNumber: invoice.invoice_number, portalToken: invoice.portal_token, status: invoice.status, customerId: invoice.customer_id, customerName: customer?.name ?? "Unknown customer", jobId: invoice.job_id, signatureName: invoice.signature_name, signedAt: invoice.signed_at, paymentMethod: invoice.payment_method, paymentStatus: invoice.payment_status, notes: invoice.notes, lineItems: (lineItems ?? []).map((item) => ({ id: item.id, label: item.label, amount: Number(item.amount) })) };
}

export async function getInvoiceByJobId(jobId: string): Promise<Invoice | null> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase.from("chillbros_invoices").select("portal_token").eq("job_id", jobId).is("revoked_at", null).neq("status", "void").order("updated_at", { ascending: false }).limit(1).maybeSingle();
  if (!data) return null;
  return getInvoiceByToken(data.portal_token);
}

export type DashboardMetrics = { openJobs: number; approvalsToday: number; lowStockParts: number; emailEventsToday: number };

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const supabase = createServiceRoleClient();
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
  const [{ count: openJobs }, { count: approvalsToday }, { data: lowStockRows }, { count: emailEventsToday }] = await Promise.all([
    supabase.from("chillbros_jobs").select("id", { count: "exact", head: true }).in("status", ["scheduled", "in_progress"]),
    supabase.from("chillbros_invoices").select("id", { count: "exact", head: true }).eq("status", "approved").gte("updated_at", startOfToday.toISOString()),
    supabase.from("chillbros_parts_catalog").select("part_number, stock").lt("stock", 5),
    supabase.from("chillbros_email_log").select("id", { count: "exact", head: true }).gte("created_at", startOfToday.toISOString()),
  ]);
  return { openJobs: openJobs ?? 0, approvalsToday: approvalsToday ?? 0, lowStockParts: (lowStockRows ?? []).filter((row) => !String(row.part_number ?? "").startsWith("PB-")).length, emailEventsToday: emailEventsToday ?? 0 };
}
