import type { ClaudeMessage } from "@/lib/chillbros/claude";
import { snapshotFor, streamChill } from "@/lib/chillbros/chill-brain";
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

  // Streamed back as one JSON object per line: the question, the answer as it is
  // written ("delta"), then "done" (with any parts links) or "error".
  const question = heard.text;
  const encoder = new TextEncoder();
  const line = (value: unknown) => encoder.encode(`${JSON.stringify(value)}\n`);
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(line({ type: "question", question }));
      try {
        for await (const event of streamChill(profile, question, history, snapshot)) {
          if (event.type === "error") console.error("[chill-ask] answer failed:", event.error);
          controller.enqueue(line(event));
        }
      } catch (error) {
        console.error("[chill-ask] stream crashed:", error);
        controller.enqueue(line({ type: "error", error: "Chilly Bro slipped on some ice. Try again." }));
      }
      controller.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" } });
}
