import "server-only";

import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";

import { askClaude, claudeConfigured, type ClaudeMessage } from "@/lib/chillbros/claude";

// One entry point for the app's AI: Claude when ANTHROPIC_API_KEY is set,
// otherwise the OpenAI key the app already uses. Callers don't care which.
const OPENAI_MODEL = process.env.OPENAI_TEXT_MODEL?.trim() || process.env.OPENAI_FIELD_NOTES_MODEL?.trim() || "gpt-5.4";

export async function askAI({ system, messages, maxTokens = 1500, timeoutMs = 45000 }: { system: string; messages: ClaudeMessage[]; maxTokens?: number; timeoutMs?: number }): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  if (claudeConfigured()) {
    const claude = await askClaude({ system, messages, maxTokens, timeoutMs });
    if (claude.ok || !process.env.OPENAI_API_KEY?.trim()) return claude;
  }
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return { ok: false, error: "AI isn't connected. Add ANTHROPIC_API_KEY or OPENAI_API_KEY in Vercel settings." };
  try {
    const result = await generateText({
      model: createOpenAI({ apiKey }).responses(OPENAI_MODEL),
      system,
      messages,
      maxOutputTokens: maxTokens,
      abortSignal: AbortSignal.timeout(timeoutMs),
      providerOptions: { openai: { store: false, reasoningEffort: "low" } },
    });
    const text = result.text.trim();
    return text ? { ok: true, text } : { ok: false, error: "The AI returned an empty answer. Try again." };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "AI request failed. Try again." };
  }
}
