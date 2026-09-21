import { createServiceRoleClient } from "@/lib/supabase/service-client";
import { checkDb, cleanupNotePhotos, processNote, FIELD_NOTE_LEASE_MS } from "@/lib/chillbros/field-notes-service";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const db = createServiceRoleClient();
    const staleBefore = new Date(Date.now() - FIELD_NOTE_LEASE_MS).toISOString();
    const { data, error } = await db.from("chillbros_field_note_submissions").select("id,status,ai_error,updated_at").or(`and(status.eq.submitted,ai_error.is.null),and(status.eq.processing,updated_at.lt.${staleBefore})`).order("updated_at").limit(3);
    checkDb(error);
    const pending = (data ?? []).filter(n => (n.status === "submitted" && !n.ai_error) || (n.status === "processing" && Date.now() - Date.parse(n.updated_at) > FIELD_NOTE_LEASE_MS)).slice(0, 3);
    const results = await Promise.allSettled(pending.map(n => processNote(n.id)));
    const { data: completed, error: completeError } = await db.from("chillbros_field_note_submissions").select("id,chillbros_field_note_images!inner(id)").eq("status", "completed").limit(20);
    checkDb(completeError);
    const cleanup = await Promise.allSettled((completed ?? []).map(n => cleanupNotePhotos(n.id, null)));
    const failures = [...results, ...cleanup].filter(r => r.status === "rejected").length;
    return Response.json({ ok: failures === 0, processing: pending.length, cleanup: completed?.length ?? 0, failures }, { status: failures ? 500 : 200 });
  } catch (cause) { console.error("[field-notes-cron]", cause); return Response.json({ error: "Field note recovery failed." }, { status: 500 }); }
}
