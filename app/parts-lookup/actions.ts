"use server";

import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";

export type PartsLookupResult = { ok: true; data: string } | { ok: false; error: string };

const MODEL = process.env.OPENAI_PARTS_LOOKUP_MODEL || "gpt-4o";

const SYSTEM_PROMPT = `You help HVAC/R and commercial-kitchen-equipment technicians start their OEM parts research. You are given a brand, model number, optionally a serial number, and optionally a description of the symptom or the part they're after.

Respond in this exact structure:

EQUIPMENT
One or two sentences identifying the likely equipment type and how confident you are, based on the brand/model given.

LIKELY OEM PART NUMBERS
A short list of the most relevant parts for what was described (or, if nothing specific was described, the most commonly replaced parts for this kind of unit — e.g. compressor, run/start capacitor, contactor, fan motor, control board, door gasket). For each: the part name, an OEM part number ONLY if you have real, specific recall of it for this exact model, and a one-line note on why it's relevant. If you do not have confident, specific recall of the exact part number for this model, say so plainly instead of guessing — write "no confident part number recalled" rather than inventing one. Never present a part number as certain when you are not.

HOW TO VERIFY
2-4 concrete next steps to confirm the exact part before ordering — e.g. checking the equipment's own data plate/parts sticker, the OEM's official parts lookup tool by model+serial, a distributor's cross-reference tool, or pulling the parts diagram for this exact model.

Keep the whole response under 350 words. Do not use markdown headers or bullet symbols beyond plain hyphens; keep it readable as plain text.`;

export async function lookupParts(formData: FormData): Promise<PartsLookupResult> {
  const profile = await getCurrentStaffProfile();
  if (!profile || !["manager", "technician", "office"].includes(profile.role)) {
    return { ok: false, error: "Sign in to use parts lookup." };
  }

  const brand = String(formData.get("brand") ?? "").trim().slice(0, 120);
  const model = String(formData.get("model") ?? "").trim().slice(0, 120);
  const serial = String(formData.get("serial") ?? "").trim().slice(0, 120);
  const details = String(formData.get("details") ?? "").trim().slice(0, 1000);

  if (!brand || !model) return { ok: false, error: "Enter at least a brand and model number." };

  const apiKey = (process.env.OPENAI_API_KEY || "").trim();
  if (!apiKey) return { ok: false, error: "AI parts lookup is not configured on this deployment (missing OPENAI_API_KEY)." };

  const userLines = [
    `Brand: ${brand}`,
    `Model number: ${model}`,
    serial ? `Serial number: ${serial}` : null,
    details ? `What I'm looking for / symptom: ${details}` : null,
  ].filter(Boolean).join("\n");

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userLines },
        ],
        temperature: 0.2,
        max_tokens: 600,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(45_000),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = payload?.error?.message || `Parts lookup failed (HTTP ${response.status}).`;
      return { ok: false, error: message };
    }

    const text = String(payload?.choices?.[0]?.message?.content ?? "").trim();
    if (!text) return { ok: false, error: "No result came back. Try again with more detail." };
    return { ok: true, data: text };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Parts lookup failed." };
  }
}
