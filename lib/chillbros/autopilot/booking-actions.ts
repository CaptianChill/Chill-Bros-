"use server";

import { revalidatePath } from "next/cache";

import { sendCompanyEmail } from "@/lib/chillbros/approval-notifications";
import { sendJobCustomerEmail } from "@/lib/chillbros/customer-communications";
import { createServiceRoleClient } from "@/lib/supabase/service-client";

import { classifyUrgency } from "./playbook";
import { activeTechnicianCount, getAutopilotSettings, loadOpenSlots, logOutreach } from "./store";
import { parseCanonicalWindow } from "./slots";

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

export type BookingInput = {
  window: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  propertyType: "residential" | "commercial";
  serviceLine: string;
  problem: string;
  ref?: { kind: "l" | "p" | "c"; value: string } | null;
  website?: string; // honeypot: real people never fill this
};

const SERVICE_LINES: Record<string, string> = {
  hvac_r: "Heating & AC",
  refrigeration: "Walk-in / refrigeration",
  ice_machine: "Ice machine",
  kitchen_equipment: "Kitchen equipment",
  exhaust_hood: "Vent hood cleaning",
  maintenance: "Maintenance / tune-up",
  other: "Other",
};

const OWNER_EMAIL = () => String(process.env.COMPANY_MAIN_EMAIL || "chillprostx@gmail.com").trim();

function clean(value: unknown, max: number) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text ? text.slice(0, max) : "";
}

function digits(value: string) {
  return value.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
}

export async function bookServiceAction(input: BookingInput): Promise<Result<{ jobNumber: string | null; window: string }>> {
  if (input.website) return { ok: false, error: "Something went wrong. Please call us." };

  const name = clean(input.name, 200);
  const phone = clean(input.phone, 40);
  const email = clean(input.email, 320).toLowerCase();
  const address = clean(input.address, 500);
  const problem = String(input.problem ?? "").trim().slice(0, 2000);
  const propertyType = input.propertyType === "commercial" ? "commercial" : "residential";
  const serviceLine = SERVICE_LINES[input.serviceLine] ? input.serviceLine : "other";
  const window = clean(input.window, 60);

  if (name.length < 2) return { ok: false, error: "Enter your name or business name." };
  if (digits(phone).length !== 10) return { ok: false, error: "Enter a 10-digit phone number so the technician can reach you." };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "Check your email address." };
  if (address.length < 6) return { ok: false, error: "Enter the service address." };
  if (problem.length < 5) return { ok: false, error: "Tell us briefly what's going on." };
  if (!parseCanonicalWindow(window)) return { ok: false, error: "Pick a time." };

  const s = createServiceRoleClient();
  const settings = await getAutopilotSettings(s);

  // Abuse guard: at most 3 online bookings per phone per day.
  const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
  const { count: recent } = await s.from("chillbros_outreach_log").select("id", { count: "exact", head: true }).eq("lane", "booking").eq("recipient", digits(phone)).gte("created_at", dayAgo);
  if ((recent ?? 0) >= 3) return { ok: false, error: "You've booked several times today. Call us and we'll help right away." };

  const open = await loadOpenSlots(s, settings);
  if (!open.some((slot) => slot.window === window)) return { ok: false, error: "That time was just taken. Please pick another." };

  // Match an existing customer by email or phone so history stays on one record.
  let customerId: string | null = null;
  if (email) {
    const { data } = await s.from("chillbros_customers").select("id").ilike("email", email).limit(1);
    customerId = data?.[0]?.id ?? null;
  }
  if (!customerId) {
    const { data } = await s.from("chillbros_customers").select("id,phone").not("phone", "is", null).limit(2000);
    customerId = (data ?? []).find((c) => c.phone && digits(String(c.phone)) === digits(phone))?.id ?? null;
  }
  let createdCustomer = false;
  if (!customerId) {
    const { data: created, error } = await s.from("chillbros_customers").insert({ name, phone, email: email || null, address }).select("id").single();
    if (error || !created) return { ok: false, error: "We couldn't save your booking. Please call us." };
    customerId = created.id;
    createdCustomer = true;
  }

  const urgency = classifyUrgency(problem);
  const scope = [
    `Online booking (${propertyType}, ${SERVICE_LINES[serviceLine]}${urgency !== "routine" ? `, ${urgency.toUpperCase()}` : ""}): ${problem}`,
    `Contact: ${name} · ${phone}${email ? ` · ${email}` : ""}`,
    `Service call quoted at booking: ${(propertyType === "commercial" ? settings.commercial_service_fee : settings.residential_service_fee) ?? "standard service fee"}.`,
  ].join("\n");

  const { data: job, error: jobError } = await s.from("chillbros_jobs").insert({
    customer_id: customerId,
    status: "scheduled",
    location: address,
    scope,
    scheduled_window: window,
    assigned_tech_id: null,
  }).select("id,job_number").single();
  if (jobError || !job) {
    if (createdCustomer) await s.from("chillbros_customers").delete().eq("id", customerId!);
    return { ok: false, error: "We couldn't save your booking. Please call us." };
  }

  // Race check: if two people grabbed the last spot at once, the later booking yields.
  const w = parseCanonicalWindow(window)!;
  const [{ data: sameDay }, techs] = await Promise.all([
    s.from("chillbros_jobs").select("id,scheduled_window,status,created_at").like("scheduled_window", `${w.date} %`).is("archived_at", null).neq("status", "cancelled").order("created_at", { ascending: true }),
    activeTechnicianCount(s),
  ]);
  const capacity = Math.max(1, settings.jobs_per_slot ?? techs);
  const overlapping = (sameDay ?? []).filter((j) => { const o = parseCanonicalWindow(j.scheduled_window); return o && o.start < w.end && o.end > w.start; });
  if (overlapping.length > capacity && overlapping.findIndex((j) => j.id === job.id) >= capacity) {
    await s.from("chillbros_jobs").delete().eq("id", job.id);
    if (createdCustomer) await s.from("chillbros_customers").delete().eq("id", customerId!);
    return { ok: false, error: "That time was just taken. Please pick another." };
  }

  await Promise.all([
    s.from("chillbros_customer_service_history").insert({ customer_id: customerId, note: `Booked online${job.job_number ? ` (${job.job_number})` : ""} for ${window}: ${problem.slice(0, 300)}` }),
    s.from("chillbros_workflow_events").insert({ job_id: job.id, stage: "online_booking", message: `Customer booked online for ${window}${input.ref ? ` · source ${input.ref.kind}` : ""}.` }),
    logOutreach(s, { lane: "booking", channel: "none", recipient: digits(phone), customer_id: customerId, status: "sent", subject: `Booked ${window}` }),
  ]);

  // Close the loop on whatever brought them here.
  const now = new Date().toISOString();
  if (input.ref?.kind === "l") {
    await s.from("chillbros_inbound_leads").update({ status: "booked", booked_at: now, customer_id: customerId, job_id: job.id, updated_at: now }).eq("token", input.ref.value);
  } else {
    // Someone booked directly: mark any open inbound lead with the same email/phone as booked.
    if (email) await s.from("chillbros_inbound_leads").update({ status: "booked", booked_at: now, customer_id: customerId, job_id: job.id, updated_at: now }).ilike("email", email).in("status", ["new", "contacted"]);
  }
  if (input.ref?.kind === "p" && /^[0-9a-f-]{36}$/i.test(input.ref.value)) {
    await s.from("chillbros_revenue_prospects").update({ outreach_done: true, job_id: job.id, sales_status: "won", status_reason: "Booked online from autopilot outreach", last_activity_at: now, updated_at: now }).eq("id", input.ref.value);
  }

  const when = formatWindow(window);
  const ownerBody = [
    `New service call booked online.`,
    ``,
    `Customer: ${name}${createdCustomer ? " (new customer)" : ""}`,
    `When: ${when}`,
    `Where: ${address}`,
    `Type: ${propertyType} · ${SERVICE_LINES[serviceLine]}${urgency !== "routine" ? ` · ${urgency.toUpperCase()}` : ""}`,
    `Problem: ${problem}`,
    `Phone: ${phone}${email ? `\nEmail: ${email}` : ""}`,
    ``,
    `It's on the schedule${job.job_number ? ` as ${job.job_number}` : ""}, unassigned. Assign a tech in Dispatch.`,
  ].join("\n");
  await sendCompanyEmail(OWNER_EMAIL(), `New service call: ${name.replace(/[^\x20-\x7E]/g, "")} - ${when}`, ownerBody).catch((e) => console.error("[autopilot] owner notice failed", e));
  if (email) await sendJobCustomerEmail(job.id, "appointment").catch((e) => console.error("[autopilot] customer confirmation failed", e));

  for (const path of ["/dispatch", "/schedule", "/office", "/"]) revalidatePath(path);
  return { ok: true, data: { jobNumber: job.job_number ?? null, window: when } };
}

function formatWindow(window: string) {
  const w = parseCanonicalWindow(window);
  if (!w) return window;
  const d = new Date(`${w.date}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric" });
  const t = (m: number) => new Date(Date.UTC(2026, 0, 1, Math.floor(m / 60), m % 60)).toLocaleTimeString("en-US", { timeZone: "UTC", hour: "numeric", minute: "2-digit" });
  return `${d}, ${t(w.start)} to ${t(w.end)}`;
}
