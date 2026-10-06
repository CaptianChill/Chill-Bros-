"use server";

import type { ClaudeMessage } from "@/lib/chillbros/claude";
import { answerChill, type ChillResult } from "@/lib/chillbros/chill-brain";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";

// Typed questions to Chilly Bro. Spoken questions go through /api/voice/ask,
// which hears and answers in one trip.
export async function askChillAction(question: string, history: ClaudeMessage[] = []): Promise<ChillResult> {
  const profile = await getCurrentStaffProfile();
  if (!profile) return { ok: false, error: "Sign in to talk to Chilly Bro." };
  return answerChill(profile, question, history);
}
