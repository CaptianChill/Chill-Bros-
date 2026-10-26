import { askAI } from "@/lib/chillbros/ai";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/hq/ai — Chill Pros HQ's "Ask" assistant, now on Claude (OpenAI as backup).
 * HQ's /api/ai is routed here (HQ project route), so HQ's page calls it unchanged:
 *   body { token, mode, context, messages: [{ role, content }] } -> { text } | { error }
 * The HQ sign-in token is checked with HQ's own hq_whoami (any HQ member; their board data arrives in `context`).
 */
const HQ_SUPABASE_URL = "https://rbhtdgqpktocavxbiafw.supabase.co";
const HQ_PUBLISHABLE_KEY = "sb_publishable_QmdOKzwUgIFM8MfZWdpeBw_8CefyFOz";
const noStore = { "Cache-Control": "no-store" };

async function hqMember(token: unknown): Promise<string | null> {
  if (typeof token !== "string" || !token || token.length > 200) return null;
  try {
    const r = await fetch(`${HQ_SUPABASE_URL}/rest/v1/rpc/hq_whoami`, {
      method: "POST",
      headers: { apikey: HQ_PUBLISHABLE_KEY, Authorization: `Bearer ${HQ_PUBLISHABLE_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_token: token }),
      cache: "no-store",
    });
    const who = r.ok ? await r.json() : null;
    return typeof who === "string" && who ? who : null;
  } catch {
    return null;
  }
}

const MODES: Record<string, string> = {
  today: "Answer whatever they ask about their day, work and boards.",
  ideas: "Help with ideas: brainstorm, pressure-test, find the money angle, first steps. When you propose distinct ideas, start each one on its own line as 'IDEA: <short title>' followed by a few lines describing it.",
  plan: "Help plan: what to do this week, break goals into steps, what's falling behind.",
  money: "Help with money: pacing, what to collect first, ways to bring in more. Use only the numbers in the data.",
  goals: "Help with goals: pace, what it takes per week to hit the next goal.",
  truck: "Help with the food truck: menu pricing (food cost %), permits, checklist, new menu items, budget.",
  cal: "Help plan the week from the schedule: what's coming, what to prep for.",
  projects: "Help with the shared projects (GIBAM ventures): what's next, what's late or has no owner, meeting agendas.",
  notes: "Help with their notes: turn them into to-dos, summarize them.",
};

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Bad request" }, { status: 400, headers: noStore });
  }
  const who = await hqMember(body.token);
  if (!who) return Response.json({ error: "Sign in again." }, { status: 401, headers: noStore });

  const mode = typeof body.mode === "string" && MODES[body.mode] ? body.mode : "today";
  const context = typeof body.context === "string" ? body.context.slice(0, 60000) : "";
  const messages = (Array.isArray(body.messages) ? body.messages : [])
    .slice(-12)
    .map((m) => {
      const msg = (m ?? {}) as { role?: unknown; content?: unknown };
      return { role: msg.role === "assistant" ? ("assistant" as const) : ("user" as const), content: typeof msg.content === "string" ? msg.content.slice(0, 4000) : "" };
    })
    .filter((m) => m.content);
  while (messages.length && messages[0].role !== "user") messages.shift();
  if (!messages.length) return Response.json({ error: "Ask something first." }, { status: 400, headers: noStore });

  const system = `You are the personal assistant inside Chill Pros HQ, a private team workspace. You are talking with "${who}".
They often use phone dictation, so fix speech-to-text mistakes silently.
${MODES[mode]}
Use ONLY the facts in BOARD DATA below for anything about their business, money, people, dates or tasks. If the data doesn't have it, say so plainly. Never invent numbers.
Be direct and practical: lead with the answer, short sentences, bullet points for lists and steps. Money in US dollars.

BOARD DATA (JSON):
${context}`;

  const result = await askAI({ system, messages, maxTokens: 1500, timeoutMs: 50000, reasoningEffort: "low" });
  if (!result.ok) return Response.json({ error: "Couldn't answer right now. Try again." }, { status: 502, headers: noStore });
  return Response.json({ text: result.text }, { headers: noStore });
}
