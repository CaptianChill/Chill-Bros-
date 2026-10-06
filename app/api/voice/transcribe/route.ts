import { MAX_AUDIO_BYTES, sameOrigin, transcribeAudio } from "@/lib/chillbros/voice";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Cross-origin request blocked." }, { status: 403 });
  const profile = await getCurrentStaffProfile();
  if (!profile) return Response.json({ error: "Sign in to talk to Chilly Bro." }, { status: 401 });
  const incoming = await request.formData().catch(() => null);
  const audio = incoming?.get("audio");
  if (!(audio instanceof File) || audio.size === 0) return Response.json({ error: "No audio was received." }, { status: 400 });
  if (audio.size > MAX_AUDIO_BYTES) return Response.json({ error: "That clip is too long." }, { status: 413 });

  const heard = await transcribeAudio(audio);
  return heard.ok ? Response.json({ text: heard.text }) : Response.json({ error: heard.error }, { status: heard.status });
}
