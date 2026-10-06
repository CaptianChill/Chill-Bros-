import "server-only";

// Chill's voice. Primary: the owner's custom ElevenLabs BOODA voice (the same
// voice as the betting app), on Eleven v3 by default. Backup: OpenAI "cedar".
// The professional, no-slang tone comes from what Chill says (see chill-assistant.ts).
export const CHILL_VOICE = "cedar";
export const CHILL_VOICE_INSTRUCTIONS =
  "Speak as Chill, the Chill Pros assistant: deep, warm, masculine baritone; calm, polished, professional delivery; clear diction; relaxed but efficient tempo; friendly and confident. Plain professional English with no slang. An original voice, not an imitation of any real person. Lead with the answer and finish promptly.";
export const MAX_SPEECH_CHARS = 900;
export const MAX_AUDIO_BYTES = 12 * 1024 * 1024;

export function elevenConfig() {
  const apiKey = (process.env.ELEVEN_API_KEY || process.env.ELEVENLABS_API_KEY || "").trim();
  const voiceId = (process.env.CHILL_ELEVEN_VOICE_ID || process.env.BOODA_ELEVEN_VOICE_ID || process.env.ELEVENLABS_VOICE_ID || "").trim();
  const model = (process.env.CHILL_ELEVEN_MODEL || "eleven_v3").trim();
  return apiKey && voiceId ? { apiKey, voiceId, model } : null;
}

// Streams MP3 from ElevenLabs. v3 speaks through the text-to-dialogue API (stability
// must be 0, 0.5 or 1; 0.5 "Natural" keeps the pace smooth and steady). Other models
// use text-to-speech with smooth, steady settings.
export async function elevenSpeech(text: string, signal?: AbortSignal) {
  const config = elevenConfig();
  if (!config) return null;
  const headers = { "xi-api-key": config.apiKey, "Content-Type": "application/json", Accept: "audio/mpeg" };
  const format = "output_format=mp3_44100_128";
  const isV3 = config.model.startsWith("eleven_v3");
  const response = isV3
    ? await fetch(`https://api.elevenlabs.io/v1/text-to-dialogue/stream?${format}`, {
        method: "POST", headers, signal, cache: "no-store",
        body: JSON.stringify({ inputs: [{ text, voice_id: config.voiceId }], model_id: config.model, language_code: "en", settings: { stability: 0.5 } }),
      })
    : await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(config.voiceId)}/stream?${format}`, {
        method: "POST", headers, signal, cache: "no-store",
        body: JSON.stringify({ text, model_id: config.model, voice_settings: { stability: 0.55, similarity_boost: 0.8, style: 0.15, speed: 1.0, use_speaker_boost: true } }),
      });
  return response;
}

export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true; // same-origin fetches may omit Origin; staff session is still required
  try { return new URL(origin).host === new URL(request.url).host; } catch { return false; }
}
