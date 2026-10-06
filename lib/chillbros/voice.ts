import "server-only";

import { keepKnownVoiceTags, stripVoiceTags } from "@/lib/chillbros/voice-tags";

// Chill's voice. Primary: the owner's custom ElevenLabs BOODA voice (the same
// voice as the betting app), on Eleven v3 by default. Backup: OpenAI "cedar".
// The professional, no-slang tone comes from what Chill says (see chill-assistant.ts).
export const CHILL_VOICE = "cedar";
export const CHILL_VOICE_INSTRUCTIONS =
  "Speak as Chilly Bro, the Chill Pros assistant: deep, warm, masculine baritone; calm, polished, professional delivery; clear diction; relaxed but efficient tempo; friendly and confident. Plain professional English with no slang. An original voice, not an imitation of any real person. Lead with the answer and finish promptly.";
export const MAX_SPEECH_CHARS = 900;
export const MAX_AUDIO_BYTES = 12 * 1024 * 1024;

export function elevenConfig() {
  const apiKey = (process.env.ELEVEN_API_KEY || process.env.ELEVENLABS_API_KEY || "").trim();
  const voiceId = (process.env.CHILL_ELEVEN_VOICE_ID || process.env.BOODA_ELEVEN_VOICE_ID || process.env.ELEVENLABS_VOICE_ID || "").trim();
  const model = (process.env.CHILL_ELEVEN_MODEL || "eleven_v3").trim();
  return apiKey && voiceId ? { apiKey, voiceId, model } : null;
}

// Speaks with the owner's ElevenLabs voice. Tries the chosen model (v3 by default,
// through text-to-dialogue with "Natural" stability), then the same voice on Turbo
// v2.5 if v3 refuses it (for example a professional clone v3 can't use yet).
// Returns the audio response, or why ElevenLabs couldn't be used.
export async function elevenSpeech(text: string, signal?: AbortSignal): Promise<{ ok: true; response: Response; model: string } | { ok: false; reason: string }> {
  const config = elevenConfig();
  if (!config) {
    const hasKey = Boolean((process.env.ELEVEN_API_KEY || process.env.ELEVENLABS_API_KEY || "").trim());
    const hasVoice = Boolean((process.env.CHILL_ELEVEN_VOICE_ID || process.env.BOODA_ELEVEN_VOICE_ID || process.env.ELEVENLABS_VOICE_ID || "").trim());
    return { ok: false, reason: !hasKey && !hasVoice ? "ElevenLabs settings not found in this deployment" : !hasKey ? "ELEVEN_API_KEY not found in this deployment" : "BOODA_ELEVEN_VOICE_ID not found in this deployment" };
  }
  const headers = { "xi-api-key": config.apiKey, "Content-Type": "application/json", Accept: "audio/mpeg" };
  const format = "output_format=mp3_44100_128";
  const attempt = (model: string) => model.startsWith("eleven_v3")
    ? fetch(`https://api.elevenlabs.io/v1/text-to-dialogue/stream?${format}`, {
        method: "POST", headers, signal, cache: "no-store",
        body: JSON.stringify({ inputs: [{ text: keepKnownVoiceTags(text), voice_id: config.voiceId }], model_id: model, settings: { stability: 0.5 }, use_pvc_as_ivc: true }),
      })
    : fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(config.voiceId)}/stream?${format}`, {
        method: "POST", headers, signal, cache: "no-store",
        body: JSON.stringify({ text: stripVoiceTags(text), model_id: model, voice_settings: { stability: 0.55, similarity_boost: 0.8, style: 0.15, speed: 1.0, use_speaker_boost: true } }),
      });

  const reasons: string[] = [];
  for (const model of [...new Set([config.model, "eleven_turbo_v2_5"])]) {
    const response = await attempt(model);
    if (response.ok && response.body) return { ok: true, response, model };
    const detail = await response.text().catch(() => "");
    let message = detail.slice(0, 200);
    try {
      const parsed = JSON.parse(detail)?.detail;
      message = typeof parsed === "string" ? parsed : parsed?.message ?? parsed?.status ?? message;
    } catch { /* keep raw text */ }
    reasons.push(`${model}: ElevenLabs ${response.status}${message ? ` ${String(message).slice(0, 160)}` : ""}`);
    // A bad key, no credits or a missing voice won't be fixed by another model.
    if ([401, 402, 404].includes(response.status)) break;
  }
  return { ok: false, reason: reasons.join(" | ") };
}

export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true; // same-origin fetches may omit Origin; staff session is still required
  try { return new URL(origin).host === new URL(request.url).host; } catch { return false; }
}

// Turns a recorded question into text (OpenAI). Shared by /api/voice/transcribe and /api/voice/ask.
export async function transcribeAudio(audio: File, signal?: AbortSignal): Promise<{ ok: true; text: string } | { ok: false; status: number; error: string }> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return { ok: false, status: 503, error: "Voice isn't configured." };
  const body = new FormData();
  body.append("file", audio, audio.name || "chill.webm");
  body.append("model", "gpt-4o-mini-transcribe");
  body.append("language", "en");
  body.append("prompt", "A short question to the Chill Pros HVAC/R service-business assistant. Preserve customer names, equipment brands, model numbers, refrigerants (R-410A, R-404A, R-134a), and dollar amounts.");
  try {
    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", { method: "POST", headers: { Authorization: `Bearer ${apiKey}` }, body, cache: "no-store", signal: signal ?? AbortSignal.timeout(30000) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("Chill transcription failed", response.status, payload?.error?.message ?? payload);
      return { ok: false, status: 502, error: "Chilly Bro couldn't hear that clearly. Try again." };
    }
    const text = typeof payload?.text === "string" ? payload.text.trim() : "";
    return text ? { ok: true, text } : { ok: false, status: 422, error: "No speech was detected." };
  } catch (error) {
    console.error("Chill transcription error", error);
    return { ok: false, status: 500, error: "Listening failed. Try again." };
  }
}
