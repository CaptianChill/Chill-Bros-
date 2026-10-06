import { CHILL_VOICE, CHILL_VOICE_INSTRUCTIONS, MAX_SPEECH_CHARS, elevenSpeech, sameOrigin } from "@/lib/chillbros/voice";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Cross-origin request blocked." }, { status: 403 });
  const profile = await getCurrentStaffProfile();
  if (!profile) return Response.json({ error: "Sign in to use Chilly Bro's voice." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const text = typeof body?.text === "string" ? body.text.trim().slice(0, MAX_SPEECH_CHARS) : "";
  if (!text) return Response.json({ error: "Nothing to say." }, { status: 400 });

  // 1) The owner's custom ElevenLabs voice, streamed straight through so playback starts sooner.
  let elevenReason = "";
  try {
    const eleven = await elevenSpeech(text, AbortSignal.timeout(30000));
    if (eleven.ok) return new Response(eleven.response.body, { status: 200, headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, no-store", "X-Chill-Voice": "elevenlabs", "X-Chill-Voice-Model": eleven.model } });
    elevenReason = eleven.reason;
    console.error("Chill ElevenLabs voice unavailable; using backup voice:", eleven.reason);
  } catch (error) {
    elevenReason = error instanceof Error ? error.message : "ElevenLabs request failed";
    console.error("Chill ElevenLabs voice error; using backup voice", error);
  }
  const reasonHeader = elevenReason.replace(/[^\x20-\x7E]/g, " ").slice(0, 400);

  // 2) Backup: OpenAI cedar.
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return Response.json({ error: "Voice isn't configured." }, { status: 503 });

  try {
    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-4o-mini-tts", voice: CHILL_VOICE, input: text, instructions: CHILL_VOICE_INSTRUCTIONS, response_format: "mp3" }),
      cache: "no-store",
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) {
      console.error("Chill voice failed", response.status, (await response.text().catch(() => "")).slice(0, 300));
      return Response.json({ error: "Chilly Bro's voice is temporarily unavailable." }, { status: 502 });
    }
    return new Response(await response.arrayBuffer(), { status: 200, headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, no-store", "X-Chill-Voice": "openai", "X-Chill-Voice-Reason": reasonHeader } });
  } catch (error) {
    console.error("Chill voice error", error);
    return Response.json({ error: "Chilly Bro's voice failed. Try again." }, { status: 500 });
  }
}
