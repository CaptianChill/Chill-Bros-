import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import { createServiceRoleClient } from "@/lib/supabase/service-client";
import { FIELD_NOTE_IMAGE_LIMIT, FIELD_NOTES_BUCKET, noteImages, readNote, requireNoteAccess, uploadNoteImage } from "@/lib/chillbros/field-notes-service";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string; imageId: string }> };
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
export async function POST(request: Request, context: Context) {
  try {
    const origin = request.headers.get("origin");
    if (!origin || origin !== new URL(request.url).origin) return Response.json({ error: "Invalid request origin." }, { status: 403 });
    const profile = await getCurrentStaffProfile();
    if (!profile || !["technician", "manager"].includes(profile.role)) return Response.json({ error: "Please sign in again; your draft is saved on this device." }, { status: 401 });
    if (Number(request.headers.get("content-length")) > FIELD_NOTE_IMAGE_LIMIT) return Response.json({ error: "Photo is too large." }, { status: 413 });
    const { id, imageId } = await context.params;
    const note = await readNote(id); requireNoteAccess(note, profile);
    const reader = request.body?.getReader();
    if (!reader) throw new Error("No photo supplied.");
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > FIELD_NOTE_IMAGE_LIMIT) { await reader.cancel(); return Response.json({ error: "Photo is too large." }, { status: 413 }); } chunks.push(value); }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    await uploadNoteImage(id, imageId, bytes, profile);
    return Response.json({ ok: true }, { headers });
  } catch (cause) { return Response.json({ error: cause instanceof Error ? cause.message : "Upload failed. Please retry." }, { status: 400, headers }); }
}
export async function GET(_request: Request, context: Context) {
  const profile = await getCurrentStaffProfile();
  if (!profile || profile.role !== "manager") return new Response("Manager access required.", { status: 403, headers });
  try {
    const { id, imageId } = await context.params;
    const note = await readNote(id); requireNoteAccess(note, profile);
    const image = (await noteImages(id)).find(i => i.id === imageId);
    if (!image) return new Response("Photo no longer available.", { status: 404, headers });
    const { data, error } = await createServiceRoleClient().storage.from(FIELD_NOTES_BUCKET).download(image.storage_path);
    if (error || !data) return new Response("Photo unavailable. Please retry.", { status: 502, headers });
    return new Response(data, { headers: { ...headers, "Content-Type": image.mime_type || "image/jpeg", "Content-Disposition": "inline" } });
  } catch { return new Response("Photo unavailable.", { status: 404, headers }); }
}
