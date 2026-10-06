import "server-only";

// Thin Claude (Anthropic Messages API) client. Uses fetch directly so the app
// needs no new npm dependency. Set ANTHROPIC_API_KEY on Vercel to turn it on;
// CLAUDE_MODEL optionally overrides the model.

export const CLAUDE_MODEL = process.env.CLAUDE_MODEL?.trim() || "claude-sonnet-5-5";

export type ClaudeMessage = { role: "user" | "assistant"; content: string };

export function claudeConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

export async function askClaude({ system, messages, maxTokens = 1500, timeoutMs = 45000 }: { system: string; messages: ClaudeMessage[]; maxTokens?: number; timeoutMs?: number }): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return { ok: false, error: "Claude isn't connected yet. Add ANTHROPIC_API_KEY in Vercel settings." };
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: maxTokens, system, messages }),
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
    const body = (await response.json().catch(() => null)) as { content?: { type: string; text?: string }[]; error?: { message?: string } } | null;
    if (!response.ok) return { ok: false, error: body?.error?.message ? `Claude: ${body.error.message}` : `Claude request failed (${response.status}).` };
    const text = (body?.content ?? []).filter((block) => block.type === "text").map((block) => block.text ?? "").join("\n").trim();
    if (!text) return { ok: false, error: "Claude returned an empty answer. Try again." };
    return { ok: true, text };
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") return { ok: false, error: "Claude took too long. Try again." };
    return { ok: false, error: error instanceof Error ? error.message : "Claude request failed." };
  }
}
