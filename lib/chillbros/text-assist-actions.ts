"use server";

import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";

import { askClaude, claudeConfigured } from "@/lib/chillbros/claude";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";

type ActionResult = { ok: true; data: string } | { ok: false; error: string };

const MODEL = process.env.OPENAI_TEXT_MODEL?.trim() || process.env.OPENAI_FIELD_NOTES_MODEL?.trim() || "gpt-5.4";

const SYSTEM_PROMPTS = {
  professional: "You rewrite Chill Pros HVAC/R service quote and invoice text so it reads clearly, courteously, and professionally to a customer. Preserve every factual detail exactly (scope, equipment, dates, quantities, terms) - never invent or drop details, prices, or claims. Keep it concise; do not pad length or add new sentences beyond what improves clarity. Return only the rewritten text with no preamble, quotes, or labels.",
  grammar: "You correct only spelling, punctuation, and grammar in this Chill Pros HVAC/R service text. Do not change wording choices, tone, meaning, or any factual detail beyond fixing actual errors. Return only the corrected text with no preamble, quotes, or labels.",
} as const;

export async function rewriteQuoteTextAction(text: string, mode: "professional" | "grammar"): Promise<ActionResult> {
  const profile = await getCurrentStaffProfile();
  if (!profile || !["manager", "office", "technician"].includes(profile.role)) return { ok: false, error: "Not signed in." };

  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: "Nothing to improve yet." };
  if (trimmed.length > 6000) return { ok: false, error: "Text is too long to rewrite at once." };

  // Claude is the primary AI when ANTHROPIC_API_KEY is set; OpenAI stays as the fallback.
  if (claudeConfigured()) {
    const claude = await askClaude({ system: SYSTEM_PROMPTS[mode], messages: [{ role: "user", content: trimmed }], maxTokens: 2000, timeoutMs: 30000 });
    if (claude.ok) return { ok: true, data: claude.text };
    if (!process.env.OPENAI_API_KEY?.trim()) return { ok: false, error: claude.error };
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return { ok: false, error: "AI text assist needs ANTHROPIC_API_KEY (Claude) or OPENAI_API_KEY on this deployment." };

  try {
    const result = await generateText({
      model: createOpenAI({ apiKey }).responses(MODEL),
      system: SYSTEM_PROMPTS[mode],
      prompt: trimmed,
      maxOutputTokens: 2000,
      abortSignal: AbortSignal.timeout(30000),
      providerOptions: { openai: { store: false, reasoningEffort: "low" } },
    });
    const output = result.text.trim();
    if (!output) throw new Error("The rewrite came back empty.");
    return { ok: true, data: output };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Rewrite failed. Please retry." };
  }
}
