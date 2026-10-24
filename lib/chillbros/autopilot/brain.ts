import "server-only";

import { askAI } from "@/lib/chillbros/ai";

import { buildPlaybook, classifyUrgency, containsUrl, hasUnapprovedPrice, type PlaybookSettings } from "./playbook";

// The autopilot's writer. The AI drafts the message body from the Chill Pros playbook;
// code adds the booking link, unsubscribe link and postal address, and falls back to a
// safe template whenever the AI is unavailable or breaks a guardrail.

export type Draft = { subject: string; body: string; sms: string | null; source: "ai" | "template" };

const SERVICE_LINE_LABEL: Record<string, string> = {
  hvac_r: "heating and air conditioning",
  refrigeration: "walk-ins, reach-ins and refrigeration",
  ice_machine: "ice machines",
  kitchen_equipment: "kitchen equipment",
  exhaust_hood: "vent hood cleaning",
  multiple: "HVAC, refrigeration and kitchen equipment",
};

function serviceLabel(line: string | null | undefined, settings: PlaybookSettings) {
  if (line === "exhaust_hood" && !settings.hood_cleaning_active) return SERVICE_LINE_LABEL.multiple;
  return SERVICE_LINE_LABEL[String(line ?? "")] ?? "HVAC and refrigeration";
}

function feeLine(settings: PlaybookSettings, commercial: boolean) {
  const fee = commercial ? settings.commercial_service_fee : settings.residential_service_fee;
  return fee ? `Service calls are ${fee}, and you get a written quote before any repair work.` : "You get a written quote before any repair work, and nothing is done without your OK.";
}

function offerLine(settings: PlaybookSettings) {
  return settings.first_time_offer ? `New customers: ${settings.first_time_offer}.` : null;
}

function firstName(name: string | null | undefined) {
  const n = String(name ?? "").trim().split(/\s+/)[0] ?? "";
  return /^[A-Za-z][A-Za-z'-]{1,20}$/.test(n) ? n : "";
}

function safeSubject(text: string) {
  // Accented letters become plain ones ("Ácenar" -> "Acenar") so subject lines stay ASCII without losing letters.
  return String(text).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[\u2018\u2019]/g, "'").replace(/[\r\n]+/g, " ").replace(/[^\x20-\x7E]/g, "").trim().slice(0, 90);
}

let aiPausedUntil = 0;

async function draftWithAI(settings: PlaybookSettings, task: string, maxWords: number): Promise<{ subject: string; body: string; sms: string | null } | null> {
  const system = `${buildPlaybook(settings)}

OUTPUT
Reply with only a JSON object: {"subject": string, "body": string, "sms": string}.
- subject: under 60 characters, plain ASCII, specific, no clickbait, no all caps.
- body: under ${maxWords} words, short paragraphs separated by blank lines, no greeting line beyond the name, no signature (it is added automatically), no URLs.
- sms: under 300 characters, no URL (the link is appended automatically).`;
  // If the AI provider is down or out of credits, use the safe templates for a while
  // instead of waiting on retries for every email in the batch.
  if (Date.now() < aiPausedUntil) return null;
  const result = await askAI({ system, messages: [{ role: "user", content: task }], maxTokens: 900, timeoutMs: 30000, reasoningEffort: "low" });
  if (!result.ok) {
    aiPausedUntil = Date.now() + 15 * 60_000;
    console.error(`[autopilot] AI drafting unavailable, using templates for 15 minutes: ${result.error}`);
    return null;
  }
  const json = result.text.slice(result.text.indexOf("{"), result.text.lastIndexOf("}") + 1);
  try {
    const parsed = JSON.parse(json) as { subject?: unknown; body?: unknown; sms?: unknown };
    const subject = safeSubject(String(parsed.subject ?? ""));
    const body = String(parsed.body ?? "").trim();
    const sms = parsed.sms ? String(parsed.sms).trim().slice(0, 300) : null;
    if (!subject || body.length < 40) return null;
    const all = `${subject}\n${body}\n${sms ?? ""}`;
    if (hasUnapprovedPrice(all, settings) || containsUrl(all)) return null; // guardrail breach: use the template
    return { subject, body, sms };
  } catch {
    return null;
  }
}

/** Instant reply to someone who reached out first. */
export async function draftInboundReply(settings: PlaybookSettings, lead: { name: string | null; message: string | null; property_type: string | null; service_line: string | null; urgency: string }): Promise<Draft> {
  const name = firstName(lead.name);
  const task = `A ${lead.property_type ?? "new"} customer just contacted Chill Pros. Write the instant reply.
Name: ${lead.name ?? "unknown"}
Urgency (pre-classified): ${lead.urgency}
Service area: ${serviceLabel(lead.service_line, settings)}
What they wrote: """${String(lead.message ?? "").slice(0, 1500)}"""
Acknowledge their specific problem in one sentence, apply the triage rules, give one useful thing to check or do safely while they wait if relevant (never anything requiring tools, panels or refrigerant), and ask them to pick a time on the booking link. If it is urgent, say the booking page shows the soonest openings.`;
  const ai = await draftWithAI(settings, task, 140);
  if (ai) return { ...ai, source: "ai" };

  const emergency = lead.urgency === "emergency";
  const urgent = lead.urgency === "urgent";
  const body = [
    `${name ? `${name}, thanks` : "Thanks"} for reaching out to Chill Pros. We got your request${lead.message ? " and the details you sent" : ""}.`,
    emergency ? "If you smell gas or something burning, leave the area and call the gas company or 911 first. Once everyone is safe, book below and we'll get a technician to you." : null,
    urgent ? "That sounds like it can't wait. The booking page shows our soonest open times, so grab the first one that works." : "Pick a time that works for you on the booking page and a technician will be there to diagnose it.",
    `Our technician will diagnose it on site. ${feeLine(settings, lead.property_type === "commercial")}`,
    offerLine(settings),
  ].filter(Boolean).join("\n\n");
  return {
    subject: urgent || emergency ? "Chill Pros: let's get you the soonest opening" : "Chill Pros: pick your service time",
    body,
    sms: `Chill Pros here: got your request${name ? `, ${name}` : ""}. ${urgent || emergency ? "Grab our soonest open time" : "Pick a time that works"} here:`,
    source: "template",
  };
}

/** Follow-up nudge for an inbound lead who hasn't booked. */
export function draftInboundNudge(lead: { name: string | null }, nudgeNumber: number): Draft {
  const name = firstName(lead.name);
  const lines = [
    `${name ? `${name}, just` : "Just"} checking in on your service request. Open times are filling, so here is the booking link again.`,
    `${name ? `${name}, still` : "Still"} need help with your equipment? Pick any open time and a technician will come diagnose it.`,
    `${name ? `${name}, last` : "Last"} check-in from us. If you still need service, the booking page is below. If it's handled, no reply needed.`,
  ];
  const body = lines[Math.min(nudgeNumber, lines.length - 1)];
  return { subject: "Chill Pros: your service request", body, sms: `Chill Pros: ${body.split(". ")[0]}. Book here:`, source: "template" };
}

/** Cold commercial outreach, steps 0..2. */
export async function draftColdEmail(settings: PlaybookSettings, prospect: { business_name: string; city: string | null; service_line: string | null; signal_summary: string | null; contact_name: string | null }, step: number): Promise<Draft> {
  const label = serviceLabel(prospect.service_line, settings);
  const stepGoal = [
    "First touch. Introduce Chill Pros in one line, name one specific pain this kind of business has with " + label + ", and offer a simple next step: book a service call or a maintenance visit.",
    "Second touch, 3 days later, brief. Different angle: preventive maintenance and backup coverage when their current vendor is busy. One or two short paragraphs.",
    "Final touch, brief and polite. Say this is the last note, leave the booking link for when they need it.",
  ][Math.min(step, 2)];
  const task = `Write a cold email from Chill Pros to a local business that has never worked with us.
Business: ${prospect.business_name}${prospect.city ? ` (${prospect.city})` : ""}
Contact name: ${prospect.contact_name ?? "unknown (do not invent one; open with the business name)"}
Relevant services: ${label}
What we know about them: ${String(prospect.signal_summary ?? "a local business in our service area").slice(0, 500)}
Goal: ${stepGoal}
Honest, specific, respectful of their time. Do not claim we noticed a problem at their business.`;
  const ai = await draftWithAI(settings, task, step === 0 ? 120 : 80);
  if (ai) return { ...ai, sms: null, source: "ai" };

  const name = firstName(prospect.contact_name);
  const opener = name ? `${name},` : `Hello ${prospect.business_name} team,`;
  const bodies = [
    `${opener}\n\nChill Pros is a San Antonio service company for ${label}. When equipment goes down, every hour costs product, comfort or sales, so we keep it simple: pick an open time online and a technician comes out and diagnoses it. ${feeLine(settings, true)}${offerLine(settings) ? ` ${offerLine(settings)}` : ""}\n\nWe also set up maintenance plans so problems get caught before they turn into emergency calls.`,
    `${opener}\n\nFollowing up on my note. A lot of local businesses keep us as a backup for when their regular company is booked up in peak season, and some switch to us for preventive maintenance. Either way, our open times are online.`,
    `${opener}\n\nThis is my last note. If ${label} ever needs attention, the booking link below shows our real open times. Thanks for your time.`,
  ];
  const subjects = [`Equipment service for ${prospect.business_name}`, `Backup service for ${prospect.business_name}`, "Last note from Chill Pros"];
  return { subject: safeSubject(subjects[Math.min(step, 2)]), body: bodies[Math.min(step, 2)], sms: null, source: "template" };
}

/** Check-in to an existing customer. */
export async function draftReactivation(settings: PlaybookSettings, customer: { name: string; lastWork: string | null; monthsSince: number | null }): Promise<Draft> {
  const task = `Write a short check-in email to an existing Chill Pros customer.
Customer: ${customer.name}
Last work we did: ${customer.lastWork ? String(customer.lastWork).slice(0, 300) : "unknown"}
Months since last visit: ${customer.monthsSince ?? "unknown"}
Tie it to the season in San Antonio (today is ${new Date().toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "America/Chicago" })}) and suggest a maintenance visit or any repairs they've been putting off. Thank them for being a customer.`;
  const ai = await draftWithAI(settings, task, 100);
  if (ai) return { ...ai, sms: null, source: "ai" };
  return {
    subject: "Time for a Chill Pros check-up?",
    body: `${customer.name},\n\nThanks for being a Chill Pros customer. It's a good time for a maintenance visit: catching a weak part now costs far less than an emergency call later.\n\nPick any open time below and we'll take care of it.`,
    sms: null,
    source: "template",
  };
}

export { classifyUrgency };

/** Plain-text email with the fixed footer every autopilot message carries. */
export function composeEmail(draft: Draft, opts: { bookingUrl: string; unsubscribeUrl?: string | null; postalAddress: string }) {
  const footer = [
    `Pick your time: ${opts.bookingUrl}`,
    "",
    "Chill Pros",
    "HVAC, refrigeration & kitchen equipment service",
    opts.postalAddress,
    opts.unsubscribeUrl ? `Don't want these emails? Unsubscribe: ${opts.unsubscribeUrl}` : null,
  ].filter((x) => x !== null).join("\n");
  return `${draft.body.trim()}\n\n${footer}`;
}
