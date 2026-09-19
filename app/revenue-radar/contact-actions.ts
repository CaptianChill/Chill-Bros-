"use server";

import { revalidatePath } from "next/cache";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import { createServiceRoleClient } from "@/lib/supabase/service-client";

const value = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const uuid = (raw: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw);
const VERIFICATION = ["unverified", "customer_reported", "source_verified", "verified"] as const;

async function salesUser() {
  const profile = await getCurrentStaffProfile();
  if (!profile || !["manager", "office"].includes(profile.role)) throw new Error("Sales contact access required.");
  return profile;
}

async function assertRevenueLeadAccess(profile: { id: string; role: string }, client: ReturnType<typeof createServiceRoleClient>, leadId: string) {
  const { data: lead, error } = await client.from("chillbros_revenue_prospects").select("id,assigned_salesperson").eq("id", leadId).maybeSingle();
  if (error || !lead) throw new Error(error?.message || "Lead not found.");
  if (profile.role === "office" && lead.assigned_salesperson !== profile.id) throw new Error("This lead is not assigned to you.");
}

async function audit(client: ReturnType<typeof createServiceRoleClient>, args: { leadId: string; contactId: string; actorId: string; action: string; previousValue?: unknown; newValue?: unknown; reason?: string | null }) {
  const { error } = await client.from("chillbros_revenue_history").insert({
    lead_id: args.leadId,
    entity_type: "contact",
    entity_id: args.contactId,
    action: args.action,
    actor_id: args.actorId,
    actor_type: "user",
    previous_value: args.previousValue ?? null,
    new_value: args.newValue ?? null,
    reason: args.reason ?? null,
  });
  if (error) throw new Error(`Audit history failed: ${error.message}`);
}

async function mirrorPrimaryContact(client: ReturnType<typeof createServiceRoleClient>, leadId: string, contact: { name?: string | null; role?: string | null; phone?: string | null; email?: string | null }) {
  const { error } = await client.from("chillbros_revenue_prospects").update({
    contact_name: contact.name || null,
    contact_role: contact.role || null,
    contact_phone: contact.phone || null,
    contact_email: contact.email || null,
  }).eq("id", leadId);
  if (error) throw new Error(error.message);
}

export async function createRevenueContact(form: FormData) {
  const profile = await salesUser();
  const leadId = value(form, "lead_id");
  const name = value(form, "name").slice(0, 200);
  const role = value(form, "role").slice(0, 200);
  const phone = value(form, "phone").slice(0, 80);
  const email = value(form, "email").slice(0, 320);
  const verification = value(form, "verification_status") || "unverified";
  const source = value(form, "source").slice(0, 500);
  const preferred = value(form, "preferred_contact_method").slice(0, 100);
  const notes = value(form, "notes").slice(0, 2000);
  const makePrimary = form.get("is_primary") === "on";
  if (!uuid(leadId) || (!name && !phone && !email) || !VERIFICATION.includes(verification as typeof VERIFICATION[number])) throw new Error("Add a name, phone, or email and select a valid verification status.");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address.");

  const client = createServiceRoleClient();
  await assertRevenueLeadAccess(profile, client, leadId);
  if (makePrimary) {
    const { error } = await client.from("chillbros_revenue_contacts").update({ is_primary: false, updated_at: new Date().toISOString() }).eq("lead_id", leadId).eq("is_primary", true);
    if (error) throw new Error(error.message);
  }
  const { data: contact, error } = await client.from("chillbros_revenue_contacts").insert({
    lead_id: leadId,
    name: name || null,
    role: role || null,
    phone: phone || null,
    email: email || null,
    verification_status: verification,
    source: source || null,
    preferred_contact_method: preferred || null,
    is_primary: makePrimary,
    notes: notes || null,
  }).select("id").single();
  if (error) throw new Error(error.message);
  if (makePrimary) await mirrorPrimaryContact(client, leadId, { name, role, phone, email });
  await audit(client, { leadId, contactId: contact.id, actorId: profile.id, action: "created", newValue: { name, role, phone, email, verificationStatus: verification, source, preferredContactMethod: preferred, isPrimary: makePrimary } });
  revalidatePath(`/revenue-radar/${leadId}/contacts`);
  revalidatePath(`/revenue-radar/${leadId}`);
}

export async function setPrimaryRevenueContact(form: FormData) {
  const profile = await salesUser();
  const leadId = value(form, "lead_id");
  const contactId = value(form, "contact_id");
  if (!uuid(leadId) || !uuid(contactId)) throw new Error("Invalid contact.");
  const client = createServiceRoleClient();
  await assertRevenueLeadAccess(profile, client, leadId);
  const { data: contact, error: contactError } = await client.from("chillbros_revenue_contacts").select("id,lead_id,name,role,phone,email,is_primary,do_not_contact").eq("id", contactId).eq("lead_id", leadId).maybeSingle();
  if (contactError || !contact) throw new Error(contactError?.message || "Contact not found.");
  if (contact.do_not_contact) throw new Error("A Do Not Contact person cannot be the primary outreach contact.");
  const { error: clearError } = await client.from("chillbros_revenue_contacts").update({ is_primary: false, updated_at: new Date().toISOString() }).eq("lead_id", leadId).eq("is_primary", true);
  if (clearError) throw new Error(clearError.message);
  const { error } = await client.from("chillbros_revenue_contacts").update({ is_primary: true, updated_at: new Date().toISOString() }).eq("id", contactId);
  if (error) throw new Error(error.message);
  await mirrorPrimaryContact(client, leadId, contact);
  await audit(client, { leadId, contactId, actorId: profile.id, action: "made_primary", previousValue: { isPrimary: contact.is_primary }, newValue: { isPrimary: true } });
  revalidatePath(`/revenue-radar/${leadId}/contacts`);
  revalidatePath(`/revenue-radar/${leadId}`);
}

export async function markRevenueContactDoNotContact(form: FormData) {
  const profile = await salesUser();
  const leadId = value(form, "lead_id");
  const contactId = value(form, "contact_id");
  const reason = value(form, "reason").slice(0, 1500);
  if (!uuid(leadId) || !uuid(contactId) || !reason) throw new Error("Contact Do Not Contact requires a reason.");
  const client = createServiceRoleClient();
  await assertRevenueLeadAccess(profile, client, leadId);
  const { data: contact, error: contactError } = await client.from("chillbros_revenue_contacts").select("id,lead_id,is_primary,do_not_contact").eq("id", contactId).eq("lead_id", leadId).maybeSingle();
  if (contactError || !contact) throw new Error(contactError?.message || "Contact not found.");
  const { error } = await client.from("chillbros_revenue_contacts").update({ do_not_contact: true, do_not_contact_reason: reason, is_primary: false, updated_at: new Date().toISOString() }).eq("id", contactId);
  if (error) throw new Error(error.message);
  if (contact.is_primary) await mirrorPrimaryContact(client, leadId, {});
  await audit(client, { leadId, contactId, actorId: profile.id, action: "do_not_contact", previousValue: { doNotContact: contact.do_not_contact, isPrimary: contact.is_primary }, newValue: { doNotContact: true, isPrimary: false }, reason });
  revalidatePath(`/revenue-radar/${leadId}/contacts`);
  revalidatePath(`/revenue-radar/${leadId}`);
}
