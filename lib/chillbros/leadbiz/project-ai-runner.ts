import "server-only";

import { askClaude, CLAUDE_MODEL, claudeConfigured } from "@/lib/chillbros/claude";
import { createServiceRoleClient } from "@/lib/supabase/service-client";

import { needsProjectAi, parseProjectAi, PROJECT_AI_SYSTEM, projectPrompt, withProjectAi, type ProjectFacts } from "./project-ai";

export const CLAUDE_OFF = "Claude is off: ANTHROPIC_API_KEY is not set for the Chill Pros app. Add it in Vercel and redeploy.";

export type CardWriterResult = { ok: boolean; written: number; failed: number; left: number; message: string };

/** Writes Claude copy for active lead-pack cards that need it (or all of them with redo), until the deadline. */
export async function writeProjectCards({ redo = false, deadlineMs = 240_000 }: { redo?: boolean; deadlineMs?: number } = {}): Promise<CardWriterResult> {
  if (!claudeConfigured()) return { ok: false, written: 0, failed: 0, left: 0, message: CLAUDE_OFF };
  const db = createServiceRoleClient();
  const { data, error } = await db.from("chillbros_leadpack_projects").select("key,industry,title,data").eq("active", true).order("added_at");
  if (error) return { ok: false, written: 0, failed: 0, left: 0, message: `Couldn't load project cards: ${error.message}` };
  const queue = ((data ?? []) as ProjectFacts[]).filter((p) => redo || needsProjectAi(p));
  const stopAt = Date.now() + deadlineMs;
  let written = 0;
  const problems: string[] = [];

  const one = async (p: ProjectFacts) => {
    const reply = await askClaude({ system: PROJECT_AI_SYSTEM, messages: [{ role: "user", content: projectPrompt(p) }], maxTokens: 6000, timeoutMs: 90_000 });
    if (!reply.ok) { problems.push(`${p.title}: ${reply.error}`); return; }
    const trades = parseProjectAi(reply.text, p);
    if (!trades) { problems.push(`${p.title}: Claude's reply was incomplete`); return; }
    const { error: saveError } = await db.from("chillbros_leadpack_projects").update({ data: withProjectAi(p, trades, CLAUDE_MODEL) }).eq("key", p.key);
    if (saveError) { problems.push(`${p.title}: save failed (${saveError.message})`); return; }
    written++;
  };

  // Three at a time; stop starting new cards once the deadline is close.
  let next = 0;
  const worker = async () => {
    while (next < queue.length && Date.now() < stopAt - 95_000) await one(queue[next++]);
  };
  await Promise.all([worker(), worker(), worker()]);
  if (problems.length) console.warn("[leadpack-claude]", problems.join(" | "));

  const left = queue.length - written - problems.length;
  const message = !queue.length
    ? "Every active card already has Claude copy."
    : `Claude wrote ${written} card${written === 1 ? "" : "s"}${problems.length ? `, ${problems.length} failed (${problems[0]})` : ""}${left > 0 ? `, ${left} left: run again` : ""}.`;
  return { ok: problems.length === 0, written, failed: problems.length, left, message };
}
