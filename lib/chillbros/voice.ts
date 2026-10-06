import "server-only";

// Chill's voice: the same OpenAI "cedar" voice as BOODA on the betting app,
// with a professional, no-slang delivery for the service business.
export const CHILL_VOICE = "cedar";
export const CHILL_VOICE_INSTRUCTIONS =
  "Speak as Chill, the Chill Pros assistant: deep, warm, masculine baritone; calm, polished, professional delivery; clear diction; relaxed but efficient tempo; friendly and confident. Plain professional English with no slang. An original voice, not an imitation of any real person. Lead with the answer and finish promptly.";
export const MAX_SPEECH_CHARS = 900;
export const MAX_AUDIO_BYTES = 12 * 1024 * 1024;

export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true; // same-origin fetches may omit Origin; staff session is still required
  try { return new URL(origin).host === new URL(request.url).host; } catch { return false; }
}
