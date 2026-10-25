import type { VoiceDraft } from "@/lib/chillbros/voice-billing";
import { ask, cancelChangeRequest, createChangeRequest, createFromDraft, getSnapshot, rejectUnlessHq, remind } from "@/lib/hq/bridge";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

const noStore = { headers: { "Cache-Control": "no-store" } };

/**
 * POST /api/hq — the owner's command center (Chill Pros HQ) bridge.
 * Server-to-server only: requires the x-hq-secret header (HQ_BRIDGE_SECRET).
 * Body: { action: "snapshot" | "ask" | "create" | "remind" | "change_create" | "change_cancel", ... }
 */
export async function POST(request: Request) {
  const denied = rejectUnlessHq(request);
  if (denied) return denied;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Bad request" }, { status: 400 });
  }
  try {
    switch (body.action) {
      case "snapshot": return Response.json(await getSnapshot(), noStore);
      case "ask": return Response.json(await ask({ message: String(body.message ?? ""), history: Array.isArray(body.history) ? body.history : [], draft: (body.draft ?? null) as VoiceDraft | null }), noStore);
      case "create": return Response.json(await createFromDraft({ draft: body.draft as VoiceDraft, send: String(body.send ?? "none") }), noStore);
      case "remind": return Response.json(await remind({ invoiceId: String(body.invoiceId ?? ""), channel: String(body.channel ?? "") }), noStore);
      case "change_create": return Response.json(await createChangeRequest({ request: String(body.request ?? "") }), noStore);
      case "change_cancel": return Response.json(await cancelChangeRequest({ id: String(body.id ?? "") }), noStore);
      default: return Response.json({ ok: false, error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    console.error("[hq] bridge error", error);
    return Response.json({ ok: false, error: "Something went wrong on the Chill Pros side." }, { status: 500 });
  }
}
