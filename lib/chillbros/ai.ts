import "server-only";

import { generateText, streamText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";

import { askClaude, claudeConfigured, type ClaudeMessage } from "@/lib/chillbros/claude";

// One entry point for the app's AI: Claude when ANTHROPIC_API_KEY is set,
// otherwise the OpenAI key the app already uses. Callers don't care which.
const OPENAI_MODEL = process.env.OPENAI_TEXT_MODEL?.trim() || process.env.OPENAI_FIELD_NOTES_MODEL?.trim() || "gpt-5.4";

// When a provider says the account is out of credits, retrying every call just
// burns time and floods the logs (thousands of errors a day from the crons).
// Pause that provider for 5 minutes and log once; it resumes on its own after a top-up.
const BILLING_PAUSE_MS = 5 * 60_000;
const BILLING_ERROR = /no credits|credit balance|insufficient_quota|exceeded your current quota|billing/i;
const pausedUntil: Record<"claude" | "openai", number> = { claude: 0, openai: 0 };

export function isBillingError(message: string) {
  return BILLING_ERROR.test(message);
}

function providerPaused(provider: "claude" | "openai") {
  return Date.now() < pausedUntil[provider];
}

function notePaused(provider: "claude" | "openai", message: string) {
  if (!isBillingError(message)) return false;
  if (!providerPaused(provider)) console.error(`[chill-ai] ${provider} is out of credits; pausing it for 5 minutes. Top up the account to restore AI. (${message})`);
  pausedUntil[provider] = Date.now() + BILLING_PAUSE_MS;
  return true;
}

const OUT_OF_CREDITS = "AI is paused: the AI account is out of credits. Add credits and it resumes automatically within 5 minutes.";

export async function askAI({ system, messages, maxTokens = 1500, timeoutMs = 45000, reasoningEffort = "low" }: { system: string; messages: ClaudeMessage[]; maxTokens?: number; timeoutMs?: number; reasoningEffort?: "none" | "minimal" | "low" | "medium" }): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  if (claudeConfigured() && !providerPaused("claude")) {
    const claude = await askClaude({ system, messages, maxTokens, timeoutMs });
    if (!claude.ok && !notePaused("claude", claude.error)) console.warn("[chill-ai] Claude failed, trying OpenAI:", claude.error);
    if (claude.ok || !process.env.OPENAI_API_KEY?.trim()) return claude;
  }
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return { ok: false, error: claudeConfigured() ? OUT_OF_CREDITS : "AI isn't connected. Add ANTHROPIC_API_KEY or OPENAI_API_KEY in Vercel settings." };
  if (providerPaused("openai")) return { ok: false, error: OUT_OF_CREDITS };
  const run = (effort: string) => generateText({
    model: createOpenAI({ apiKey }).responses(OPENAI_MODEL),
    system,
    messages,
    maxOutputTokens: maxTokens,
    abortSignal: AbortSignal.timeout(timeoutMs),
    providerOptions: { openai: { store: false, reasoningEffort: effort } },
  });
  try {
    // A quicker effort setting the chosen model may not accept falls back to "low".
    const result = await run(reasoningEffort).catch((error) => {
      if (reasoningEffort === "low" || !/reasoning|effort|unsupported|invalid/i.test(String(error?.message ?? error))) throw error;
      return run("low");
    });
    const text = result.text.trim();
    return text ? { ok: true, text } : { ok: false, error: "The AI returned an empty answer. Try again." };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (notePaused("openai", message)) return { ok: false, error: OUT_OF_CREDITS };
    console.error(`[chill-ai] OpenAI ${OPENAI_MODEL} failed:`, message);
    return { ok: false, error: error instanceof Error ? error.message : "AI request failed. Try again." };
  }
}

// Streams an answer piece by piece so the screen (and the voice) can start before
// the whole reply is written. Claude, when configured, answers in one piece.
// CHILL_TEXT_MODEL can point spoken answers at a faster model without touching code.
export async function* streamAI({ system, messages, maxTokens = 400, timeoutMs = 25000, model }: { system: string; messages: ClaudeMessage[]; maxTokens?: number; timeoutMs?: number; model?: string }): AsyncGenerator<string> {
  if (claudeConfigured() && !providerPaused("claude")) {
    const claude = await askClaude({ system, messages, maxTokens, timeoutMs });
    if (claude.ok) { yield claude.text; return; }
    if (!notePaused("claude", claude.error)) console.error("[chill-ai] Claude failed, trying OpenAI:", claude.error);
    if (!process.env.OPENAI_API_KEY?.trim()) throw new Error(claude.error);
  }
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error(claudeConfigured() ? OUT_OF_CREDITS : "AI isn't connected. Add ANTHROPIC_API_KEY or OPENAI_API_KEY in Vercel settings.");
  if (providerPaused("openai")) throw new Error(OUT_OF_CREDITS);
  const chosen = model?.trim() || OPENAI_MODEL;
  const run = (effort: string | undefined) => {
    let failure: unknown = null;
    const result = streamText({
      model: createOpenAI({ apiKey }).responses(chosen),
      system,
      messages,
      maxOutputTokens: maxTokens,
      abortSignal: AbortSignal.timeout(timeoutMs),
      providerOptions: { openai: effort ? { store: false, reasoningEffort: effort } : { store: false } },
      onError: ({ error }) => { failure = error; },
    });
    return { result, failed: () => failure };
  };
  // "none" keeps reasoning models instant; a model that rejects it is retried without the setting.
  for (const effort of ["none", undefined]) {
    const { result, failed } = run(effort);
    let sent = false;
    for await (const piece of result.textStream) { if (piece) { sent = true; yield piece; } }
    const error = failed();
    if (!error) { if (!sent) throw new Error("The AI returned an empty answer. Try again."); return; }
    const message = error instanceof Error ? error.message : String(error);
    if (notePaused("openai", message)) throw new Error(OUT_OF_CREDITS);
    console.error(`[chill-ai] OpenAI ${chosen} (effort ${effort ?? "default"}) failed:`, message);
    if (sent || effort === undefined || !/reasoning|effort|unsupported|invalid/i.test(message)) throw new Error(message);
  }
}
