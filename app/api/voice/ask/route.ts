import type { ClaudeMessage } from "@/lib/chillbros/claude";
import { answerChill, snapshotFor } from "@/lib/chillbros/chill-brain";
import { MAX_AUDIO_BYTES, sameOrigin, transcribeAudio } from "@/lib/chillbros/voice";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// OEM parts lookups search the web and can take up to about a minute.
export const maxDuration = 120;

// One trip for a question to Chilly Bro: hears it (or takes typed text) and answers it. The live business
// snapshot is gathered while the audio is still being transcribed, so Chilly Bro
// can answer as soon as the words are known.
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Cross-origin request blocked." }, { status: 403 });
  const profile = await getCurrentStaffProfile();
  if (!profile) return Response.json({ error: "Sign in to talk to Chilly Bro." }, { status: 401 });

  const incoming = await request.formData().catch(() => null);
  const typed = String(incoming?.get("question") ?? "").trim();
  const audio = incoming?.get("audio");
  if (!typed) {
    if (!(audio instanceof File) || audio.size === 0) return Response.json({ error: "No audio was received." }, { status: 400 });
    if (audio.size > MAX_AUDIO_BYTES) return Response.json({ error: "That clip is too long." }, { status: 413 });
  }

  let history: ClaudeMessage[] = [];
  try {
    const parsed = JSON.parse(String(incoming?.get("history") ?? "[]"));
    if (Array.isArray(parsed)) history = parsed.filter((m) => (m?.role === "user" || m?.role === "assistant") && typeof m?.content === "string").slice(-8);
  } catch { /* no history */ }

  const snapshot = snapshotFor(profile).catch(() => "Business snapshot is unavailable right now.");
  const heard = typed ? { ok: true as const, text: typed } : await transcribeAudio(audio as File);
  if (!heard.ok) return Response.json({ error: heard.error }, { status: heard.status });

  const result = await answerChill(profile, heard.text, history, snapshot);
  return result.ok
    ? Response.json({ question: heard.text, answer: result.answer, links: result.links ?? [] })
    : Response.json({ question: heard.text, error: result.error }, { status: 502 });
}
