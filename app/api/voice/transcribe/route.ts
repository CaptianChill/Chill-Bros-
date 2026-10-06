import { MAX_AUDIO_BYTES, sameOrigin } from "@/lib/chillbros/voice";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Cross-origin request blocked." }, { status: 403 });
  const profile = await getCurrentStaffProfile();
  if (!profile) return Response.json({ error: "Sign in to talk to Chill." }, { status: 401 });
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return Response.json({ error: "Voice isn't configured." }, { status: 503 });

  const incoming = await request.formData().catch(() => null);
  const audio = incoming?.get("audio");
  if (!(audio instanceof File) || audio.size === 0) return Response.json({ error: "No audio was received." }, { status: 400 });
  if (audio.size > MAX_AUDIO_BYTES) return Response.json({ error: "That clip is too long." }, { status: 413 });

  const body = new FormData();
  body.append("file", audio, audio.name || "chill.webm");
  body.append("model", "gpt-4o-mini-transcribe");
  body.append("language", "en");
  body.append("prompt", "A short question to the Chill Pros HVAC/R service-business assistant. Preserve customer names, equipment brands, model numbers, refrigerants (R-410A, R-404A, R-134a), and dollar amounts.");

  try {
    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", { method: "POST", headers: { Authorization: `Bearer ${apiKey}` }, body, cache: "no-store", signal: AbortSignal.timeout(30000) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("Chill transcription failed", response.status, payload?.error?.message ?? payload);
      return Response.json({ error: "Chill couldn't hear that clearly. Try again." }, { status: 502 });
    }
    const text = typeof payload?.text === "string" ? payload.text.trim() : "";
    if (!text) return Response.json({ error: "No speech was detected." }, { status: 422 });
    return Response.json({ text });
  } catch (error) {
    console.error("Chill transcription error", error);
    return Response.json({ error: "Listening failed. Try again." }, { status: 500 });
  }
}
