import { buildVoiceDraft, type VoiceDraft } from "@/lib/chillbros/voice-billing";
import { MAX_AUDIO_BYTES, sameOrigin, transcribeAudio } from "@/lib/chillbros/voice";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const BILLING_PROMPT = "Chill Pros, quote, invoice, down payment, labor hours, trip charge, capacitor, contactor, compressor, condenser fan motor, TXV, R-410A, R-404A, R-454B, R-134a, part number, MFD, Net 15, Net 30.";

// Owner/office speaks (or types) → returns a structured quote/invoice draft. Creates nothing.
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Cross-origin request blocked." }, { status: 403 });
  const profile = await getCurrentStaffProfile();
  if (!profile) return Response.json({ error: "Sign in first." }, { status: 401 });
  if (!["manager", "office"].includes(profile.role)) return Response.json({ error: "Only the owner or office can create quotes and invoices." }, { status: 403 });

  const incoming = await request.formData().catch(() => null);
  if (!incoming) return Response.json({ error: "Nothing was received." }, { status: 400 });
  const documentType = incoming.get("documentType") === "invoice" ? "invoice" : "quote";
  let previous: VoiceDraft | null = null;
  try { const p = incoming.get("previous"); if (typeof p === "string" && p) previous = JSON.parse(p) as VoiceDraft; } catch { previous = null; }

  let transcript = String(incoming.get("text") ?? "").trim();
  const audio = incoming.get("audio");
  if (audio instanceof File && audio.size > 0) {
    if (audio.size > MAX_AUDIO_BYTES) return Response.json({ error: "That recording is too long. Split it into two parts." }, { status: 413 });
    const heard = await transcribeAudio(audio, AbortSignal.timeout(60000), BILLING_PROMPT);
    if (!heard.ok) return Response.json({ error: heard.error }, { status: heard.status });
    transcript = [transcript, heard.text].filter(Boolean).join(" ");
  }
  if (!transcript) return Response.json({ error: "Say or type what goes on the quote or invoice." }, { status: 400 });

  const result = await buildVoiceDraft({ transcript, documentType, previous });
  return result.ok ? Response.json({ transcript, draft: result.draft, intent: result.intent, reply: result.reply }) : Response.json({ error: result.error, transcript }, { status: 502 });
}
