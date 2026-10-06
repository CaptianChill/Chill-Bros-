// Emotion tags Chilly Bro puts in his answers, like "[excited]". Eleven v3 performs
// them as voice direction; everywhere else (the chat bubble, other voices) they are
// removed. Safe to import on the client and the server.

export const VOICE_TAGS = ["excited", "happy", "laughs", "chuckles", "curious", "surprised", "sighs", "whispers"] as const;
export type VoiceTag = (typeof VOICE_TAGS)[number];

const TAG = /\[\s*([a-z][a-z ]{1,24})\s*\]/gi;

// Removes every bracketed cue and tidies the spacing it leaves behind.
export function stripVoiceTags(text: string) {
  return text.replace(TAG, " ").replace(/\s+([,.!?])/g, "$1").replace(/\s+/g, " ").trim();
}

// Keeps only the known tags (for Eleven v3), dropping anything else in brackets.
export function keepKnownVoiceTags(text: string) {
  return text.replace(TAG, (whole, name: string) => ((VOICE_TAGS as readonly string[]).includes(name.trim().toLowerCase()) ? `[${name.trim().toLowerCase()}]` : " ")).replace(/\s+/g, " ").trim();
}

// The first known tag in an answer, used to pick Chilly Bro's reaction animation.
export function firstVoiceTag(text: string): VoiceTag | null {
  for (const match of text.matchAll(TAG)) {
    const name = match[1].trim().toLowerCase();
    if ((VOICE_TAGS as readonly string[]).includes(name)) return name as VoiceTag;
  }
  return null;
}
