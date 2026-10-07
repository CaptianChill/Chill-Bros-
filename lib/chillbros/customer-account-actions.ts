"use server";

import { revalidatePath } from "next/cache";

import { sendCompanyEmail } from "@/lib/chillbros/approval-notifications";
import {
  createLoginCode,
  endCustomerSession,
  getCustomerSession,
  linkFromTarget,
  linkNewCustomer,
  normalizeEmail,
  resolveLinkTarget,
  startCustomerSession,
  upsertAccountAndLink,
  verifyLoginCode,
} from "@/lib/chillbros/customer-account";
import { createServiceRoleClient } from "@/lib/supabase/service-client";

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

const OWNER_NOTIFY_EMAIL = () => String(process.env.COMPANY_MAIN_EMAIL || "chillprostx@gmail.com").trim();

function clean(value: unknown, max: number) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text ? text.slice(0, max) : null;
}

function cleanMultiline(value: unknown, max: number) {
  const text = String(value ?? "").replace(/\r\n/g, "\n").trim();
  return text ? text.slice(0, max) : null;
}

/** Step 1 of sign-in: email a 6-digit code. Same response whether or not the email is on file. */
export async function requestCustomerCodeAction(rawEmail: string): Promise<Result<{ email: string }>> {
  const email = normalizeEmail(rawEmail);
  if (!email) return { ok: false, error: "Enter a valid email address." };
  let code: string | null;
  try {
    code = await createLoginCode(email);
  } catch {
    return { ok: false, error: "Something went wrong. Try again in a minute." };
  }
  if (!code) return { ok: false, error: "Too many codes requested. Wait a few minutes, then try again." };

  const text = `Your Chill Pros sign-in code is ${code}\n\nEnter it on the sign-in screen. It expires in 10 minutes.\n\nIf you didn't ask for this, you can ignore this email.\n\nChill Pros · HVAC & Refrigeration · San Antonio, Texas`;
  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:480px;margin:0 auto;color:#0B1220">
<div style="background:#05070A;padding:18px;text-align:center;border-bottom:3px solid #1F6FEB"><span style="color:#9CCBFF;font-weight:800;font-size:20px;letter-spacing:.04em">CHILL PROS</span></div>
<div style="padding:24px 20px;text-align:center">
<p style="margin:0 0 8px;font-size:16px">Your sign-in code is</p>
<p style="margin:0 0 16px;font-size:36px;font-weight:800;letter-spacing:.3em">${code}</p>
<p style="margin:0;color:#3D5170;font-size:14px">It expires in 10 minutes. If you didn't ask for this, you can ignore this email.</p>
</div></div>`;
  const sent = await sendCompanyEmail(email, `Your Chill Pros sign-in code: ${code}`, text, html).catch(() => ({ status: "failed" as const }));
  if (sent.status !== "sent") return { ok: false, error: "We couldn't send the code right now. Try again, or email chillprostx@gmail.com." };
  return { ok: true, data: { email } };
}

/** Step 2: check the code, link existing records, start the session. */
export async function verifyCustomerCodeAction(rawEmail: string, code: string, link?: { kind: string; token: string } | null): Promise<Result<{ needsProfile: boolean }>> {
  const email = normalizeEmail(rawEmail);
  if (!email) return { ok: false, error: "Enter a valid email address." };
  const check = await verifyLoginCode(email, String(code ?? ""));
  if (check === "invalid") return { ok: false, error: "That code isn't right. Check the email and try again." };
  if (check === "expired") return { ok: false, error: "That code expired. Send a new one." };
  if (check === "locked") return { ok: false, error: "Too many tries. Send a new code." };
  try {
    const linked = await upsertAccountAndLink(email);
    const { accountId } = linked;
    let { customerIds } = linked;
    const target = link ? await resolveLinkTarget(link.kind, link.token) : null;
    if (target) {
      await linkFromTarget(accountId, email, target);
      if (!customerIds.includes(target.customerId)) customerIds = [...customerIds, target.customerId];
    }
    await startCustomerSession(accountId);
    return { ok: true, data: { needsProfile: customerIds.length === 0 } };
  } catch {
    return { ok: false, error: "Something went wrong signing you in. Try again." };
  }
}

/** New customers (no record on file yet) tell us who they are once. */
export async function completeCustomerProfileAction(input: { name: string; phone: string; address: string }): Promise<Result> {
  const session = await getCustomerSession();
  if (!session) return { ok: false, error: "Your sign-in expired. Sign in again." };
  if (session.customerIds.length) return { ok: true, data: undefined };

  const name = clean(input.name, 200);
  const phone = clean(input.phone, 50);
  const address = clean(input.address, 500);
  if (!name) return { ok: false, error: "Enter your name or business name." };
  if (!phone || phone.replace(/\D/g, "").length < 10) return { ok: false, error: "Enter a phone number we can reach you at." };
  if (!address) return { ok: false, error: "Enter the service address." };

  const s = createServiceRoleClient();
  const { data: customer, error } = await s.from("chillbros_customers").insert({ name, phone, address, email: session.email }).select("id").single();
  if (error || !customer) return { ok: false, error: "We couldn't save your details. Try again." };
  await linkNewCustomer(session.accountId, customer.id);
  await s.from("chillbros_customer_service_history").insert({ customer_id: customer.id, note: "Customer created their own account on the customer homepage." });
  await sendCompanyEmail(OWNER_NOTIFY_EMAIL(), `New customer signed up: ${name}`, `${name} created a customer account.\n\nEmail: ${session.email}\nPhone: ${phone}\nAddress: ${address}\n\nThey're in your Customer Center now.`).catch(() => null);
  revalidatePath("/customers");
  return { ok: true, data: undefined };
}

export type ServiceRequestInput = {
  customerId: string;
  equipmentId?: string | null;
  problem: string;
  urgency: "routine" | "soon" | "emergency";
  preferredTime?: string;
  contactName?: string;
  contactPhone?: string;
};

const URGENCY_LABEL: Record<ServiceRequestInput["urgency"], string> = {
  routine: "Routine",
  soon: "Soon (within a few days)",
  emergency: "Emergency (down now)",
};

/** Creates a work order in Dispatch → Unassigned as "Needs Scheduling". The office books it. */
export async function submitServiceRequestAction(input: ServiceRequestInput): Promise<Result<{ jobNumber: string | null }>> {
  const session = await getCustomerSession();
  if (!session) return { ok: false, error: "Your sign-in expired. Sign in again." };
  if (!session.customerIds.includes(String(input.customerId))) return { ok: false, error: "Choose your location." };

  const problem = cleanMultiline(input.problem, 2000);
  if (!problem || problem.length < 5) return { ok: false, error: "Tell us what's going on." };
  const urgency = URGENCY_LABEL[input.urgency] ? input.urgency : "routine";
  const preferred = clean(input.preferredTime, 200);
  const contactName = clean(input.contactName, 120);
  const contactPhone = clean(input.contactPhone, 50);

  const s = createServiceRoleClient();
  const { data: customer } = await s.from("chillbros_customers").select("id,name,address,phone").eq("id", input.customerId).maybeSingle();
  if (!customer) return { ok: false, error: "Choose your location." };

  let equipmentLabel: string | null = null;
  let equipmentId: string | null = null;
  if (input.equipmentId) {
    const { data: unit } = await s.from("chillbros_equipment").select("id,customer_id,asset_tag,equipment_type,manufacturer,model").eq("id", input.equipmentId).maybeSingle();
    if (!unit || unit.customer_id !== customer.id) return { ok: false, error: "Choose one of your units." };
    equipmentId = unit.id;
    equipmentLabel = [unit.equipment_type, unit.manufacturer, unit.model, unit.asset_tag ? `Tag ${unit.asset_tag}` : null].filter(Boolean).join(" · ");
  }

  // Guard against accidental repeat taps / abuse: max 5 customer requests per account per day.
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await s.from("chillbros_workflow_events").select("id", { count: "exact", head: true }).eq("stage", "customer_service_request").gte("created_at", dayAgo).like("message", `%account ${session.accountId}%`);
  if ((count ?? 0) >= 5) return { ok: false, error: "You've sent several requests today. Call or email us and we'll help right away." };

  const scope = [
    `Customer request (${URGENCY_LABEL[urgency]}): ${problem}`,
    equipmentLabel ? `Unit: ${equipmentLabel}` : null,
    preferred ? `Customer prefers: ${preferred}` : null,
    contactName || contactPhone ? `On-site contact: ${[contactName, contactPhone].filter(Boolean).join(" · ")}` : null,
  ].filter(Boolean).join("\n");

  const { data: job, error } = await s.from("chillbros_jobs").insert({
    customer_id: customer.id,
    equipment_id: equipmentId,
    status: "needs_scheduling",
    location: customer.address,
    scope,
    scheduled_window: null,
    assigned_tech_id: null,
  }).select("id,job_number").single();
  if (error || !job) return { ok: false, error: "We couldn't send your request. Try again, or call us." };

  await Promise.all([
    s.from("chillbros_workflow_events").insert({ job_id: job.id, stage: "customer_service_request", message: `Customer requested service from the customer homepage (${URGENCY_LABEL[urgency]}) · account ${session.accountId}` }),
    s.from("chillbros_customer_service_history").insert({ customer_id: customer.id, note: `Customer requested service online${job.job_number ? ` (${job.job_number})` : ""}: ${problem.slice(0, 300)}` }),
  ]);

  const subject = `${urgency === "emergency" ? "EMERGENCY " : ""}Service request: ${customer.name}`;
  const body = `${customer.name} requested service from their customer homepage.\n\nUrgency: ${URGENCY_LABEL[urgency]}\nProblem: ${problem}${equipmentLabel ? `\nUnit: ${equipmentLabel}` : ""}${preferred ? `\nPrefers: ${preferred}` : ""}${contactName || contactPhone ? `\nOn-site contact: ${[contactName, contactPhone].filter(Boolean).join(" · ")}` : ""}\nAddress: ${customer.address ?? "not on file"}\nPhone on file: ${customer.phone ?? "none"}\n\nIt's in Dispatch → Unassigned as "Needs Scheduling"${job.job_number ? ` (${job.job_number})` : ""}.`;
  await sendCompanyEmail(OWNER_NOTIFY_EMAIL(), subject, body).catch(() => null);

  for (const path of ["/dispatch", "/office", "/", "/my"]) revalidatePath(path);
  return { ok: true, data: { jobNumber: job.job_number ?? null } };
}

/** Already signed in and opened a personal link: connect that record too. */
export async function linkSignedInCustomerAction(link: { kind: string; token: string }): Promise<Result> {
  const session = await getCustomerSession();
  if (!session) return { ok: false, error: "Sign in again." };
  const target = await resolveLinkTarget(link.kind, link.token);
  if (!target) return { ok: false, error: "That link has expired. Ask Chill Pros for a new one." };
  await linkFromTarget(session.accountId, session.email, target);
  return { ok: true, data: undefined };
}

export async function customerSignOutAction(): Promise<Result> {
  await endCustomerSession();
  return { ok: true, data: undefined };
}
