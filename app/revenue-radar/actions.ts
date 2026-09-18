"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import { createServiceRoleClient } from "@/lib/supabase/service-client";
import { categories, normalizedKey, scoreSignal, serviceLines, statuses } from "@/lib/chillbros/revenue-radar";

async function office() {
  const profile = await getCurrentStaffProfile();
  if (!profile || !["manager", "office"].includes(profile.role)) throw new Error("Office access required.");
  return profile;
}
const value = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

export async function addProspect(form: FormData) {
  const profile = await office();
  const name = value(form, "business_name").slice(0, 200);
  const city = value(form, "city").slice(0, 100) || "San Antonio";
  const category = value(form, "category");
  const serviceLine = value(form, "service_line");
  const summary = value(form, "signal_summary").slice(0, 3000);
  const source = value(form, "source_url");
  const observed = value(form, "signal_observed_at");
  if (!name || !summary || !categories.includes(category as typeof categories[number]) || !serviceLines.includes(serviceLine as typeof serviceLines[number])) throw new Error("Complete the required prospect fields.");
  let url: URL;
  try { url = new URL(source); } catch { throw new Error("Enter a valid source URL."); }
  if (!["https:", "http:"].includes(url.protocol) || !observed || Number.isNaN(new Date(observed).getTime()) || new Date(observed).getTime() > Date.now() + 86400000) throw new Error("Enter a valid source URL and signal date.");
  const observedAt = new Date(observed).toISOString();
  const verified = form.get("signal_verified") === "on";
  const { data, error } = await createServiceRoleClient().from("chillbros_revenue_prospects").insert({
    business_name: name, city, category, service_line: serviceLine, signal_summary: summary,
    source_url: url.toString(), signal_observed_at: observedAt, signal_verified: verified,
    normalized_key: normalizedKey(name, city, category, url.toString()),
    score: scoreSignal(category, observedAt, verified), created_by: profile.id, updated_by: profile.id,
  }).select("id").single();
  if (error) throw new Error(error.code === "23505" ? "This signal is already on the radar." : error.message);
  revalidatePath("/revenue-radar");
  redirect(`/revenue-radar/${data.id}`);
}

export async function updateProspect(form: FormData) {
  const profile = await office();
  const id = value(form, "id");
  const status = value(form, "status");
  if (!/^[0-9a-f-]{36}$/i.test(id) || !statuses.includes(status as typeof statuses[number])) throw new Error("Invalid prospect update.");
  const money = (key: string) => { const raw = value(form, key); const n = Number(raw); if (raw && (!Number.isFinite(n) || n < 0)) throw new Error("Amounts must be positive."); return raw ? n : null; };
  const date = value(form, "follow_up_at");
  if (date && Number.isNaN(new Date(date).getTime())) throw new Error("Invalid follow-up date.");
  const jobId = value(form, "job_id");
  const invoiceId = value(form, "invoice_id");
  for (const linkedId of [jobId, invoiceId]) if (linkedId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(linkedId)) throw new Error("Linked job and quote IDs must be valid IDs.");
  const { error } = await createServiceRoleClient().from("chillbros_revenue_prospects").update({
    status, contact_name: value(form, "contact_name").slice(0, 200) || null,
    contact_role: value(form, "contact_role").slice(0, 200) || null,
    contact_email: value(form, "contact_email").slice(0, 320) || null,
    contact_phone: value(form, "contact_phone").slice(0, 60) || null,
    email_subject: value(form, "email_subject").slice(0, 300) || null,
    email_draft: value(form, "email_draft").slice(0, 5000) || null,
    business_address: value(form, "business_address").slice(0, 500) || null,
    sender_postal_address: value(form, "sender_postal_address").slice(0, 500) || null,
    unsubscribe_instructions: value(form, "unsubscribe_instructions").slice(0, 500) || null,
    follow_up_at: date ? new Date(date).toISOString() : null,
    follow_up_note: value(form, "follow_up_note").slice(0, 1000) || null,
    job_id: jobId || null, invoice_id: invoiceId || null,
    estimated_revenue: money("estimated_revenue"), actual_revenue: money("actual_revenue"), direct_cost: money("direct_cost"),
    updated_by: profile.id, updated_at: new Date().toISOString(),
  }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/revenue-radar");
  revalidatePath(`/revenue-radar/${id}`);
}
