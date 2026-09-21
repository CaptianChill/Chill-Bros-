import { NextRequest, NextResponse } from "next/server";

import type { FormDraft, FormDraftField } from "@/lib/chillbros/form-drafts";
import { getCurrentStaffProfile, type StaffProfile } from "@/lib/supabase/auth-server";
import { createServiceRoleClient } from "@/lib/supabase/service-client";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BODY_BYTES = 600_000;

type DraftRow = {
  draft_key: string;
  path: string;
  label: string;
  customer_id: string | null;
  form_index: number;
  fields: unknown;
  updated_at: string;
};

function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  return !origin || origin === request.nextUrl.origin;
}

function mapRow(row: DraftRow): FormDraft {
  return {
    id: row.draft_key,
    path: row.path,
    label: row.label,
    customerId: row.customer_id,
    formIndex: row.form_index,
    updatedAt: row.updated_at,
    fields: Array.isArray(row.fields) ? row.fields as FormDraftField[] : [],
  };
}

function parseDraft(input: unknown): Omit<FormDraft, "updatedAt"> | null {
  if (!input || typeof input !== "object") return null;
  const value = input as Record<string, unknown>;
  const id = typeof value.id === "string" ? value.id.trim() : "";
  const path = typeof value.path === "string" ? value.path.trim() : "";
  const label = typeof value.label === "string" ? value.label.trim() : "";
  const formIndex = typeof value.formIndex === "number" ? value.formIndex : Number.NaN;
  const customerId = typeof value.customerId === "string" && UUID.test(value.customerId) ? value.customerId : null;
  if (!id || id.length > 500 || !path.startsWith("/") || path.startsWith("//") || path.length > 1000) return null;
  if (!label || label.length > 120 || !Number.isInteger(formIndex) || formIndex < 0 || formIndex > 1000) return null;
  if (!Array.isArray(value.fields) || value.fields.length > 250) return null;

  const fields: FormDraftField[] = [];
  for (const item of value.fields) {
    if (!item || typeof item !== "object") return null;
    const field = item as Record<string, unknown>;
    if (typeof field.name !== "string" || !field.name || field.name.length > 200) return null;
    if (typeof field.type !== "string" || field.type.length > 40) return null;
    if (typeof field.value !== "string" || field.value.length > 100_000) return null;
    const occurrence = typeof field.occurrence === "number" && Number.isInteger(field.occurrence) && field.occurrence >= 0 && field.occurrence < 250
      ? field.occurrence
      : undefined;
    fields.push({
      name: field.name,
      type: field.type,
      value: field.value,
      ...(typeof field.checked === "boolean" ? { checked: field.checked } : {}),
      ...(occurrence !== undefined ? { occurrence } : {}),
    });
  }

  return { id, path, label, customerId, formIndex, fields };
}

type Context = { profile: StaffProfile; service: ReturnType<typeof createServiceRoleClient> };

async function currentContext(): Promise<Context | null> {
  const profile = await getCurrentStaffProfile();
  if (!profile) return null;
  return { profile, service: createServiceRoleClient() };
}

export async function GET(request: NextRequest) {
  const context = await currentContext();
  if (!context) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const { profile, service } = context;
  let query = service
    .from("chillbros_staff_drafts")
    .select("draft_key,path,label,customer_id,form_index,fields,updated_at")
    .eq("owner_profile_id", profile.id);

  const id = request.nextUrl.searchParams.get("id")?.trim();
  const path = request.nextUrl.searchParams.get("path")?.trim();
  const customerId = request.nextUrl.searchParams.get("customerId")?.trim();
  if (id) query = query.eq("draft_key", id.slice(0, 500));
  if (path) query = query.eq("path", path.slice(0, 1000));
  if (customerId && UUID.test(customerId)) query = query.eq("customer_id", customerId);

  const { data, error } = await query.order("updated_at", { ascending: false }).limit(80);
  if (error) {
    console.error("[form-drafts] read failed", { code: error.code, message: error.message });
    return NextResponse.json({ error: "Drafts could not be loaded." }, { status: 500 });
  }
  return NextResponse.json({ drafts: (data ?? []).map((row) => mapRow(row as DraftRow)) });
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const context = await currentContext();
  if (!context) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const { profile, service } = context;
  const contentLength = Number(request.headers.get("content-length") || "0");
  if (contentLength > MAX_BODY_BYTES) return NextResponse.json({ error: "Draft is too large." }, { status: 413 });

  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) return NextResponse.json({ error: "Draft is too large." }, { status: 413 });
  const parsed = parseDraft((() => { try { return JSON.parse(rawBody); } catch { return null; } })());
  if (!parsed) return NextResponse.json({ error: "Invalid draft." }, { status: 400 });

  const now = new Date().toISOString();
  const { data, error } = await service
    .from("chillbros_staff_drafts")
    .upsert({
      owner_profile_id: profile.id,
      draft_key: parsed.id,
      path: parsed.path,
      label: parsed.label,
      customer_id: parsed.customerId,
      form_index: parsed.formIndex,
      fields: parsed.fields,
      updated_at: now,
    }, { onConflict: "owner_profile_id,draft_key" })
    .select("draft_key,path,label,customer_id,form_index,fields,updated_at")
    .single();

  if (error || !data) {
    console.error("[form-drafts] save failed", { code: error?.code, message: error?.message });
    return NextResponse.json({ error: "Draft could not be saved." }, { status: 500 });
  }
  return NextResponse.json({ draft: mapRow(data as DraftRow) });
}

export async function DELETE(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const context = await currentContext();
  if (!context) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const { profile, service } = context;
  const id = request.nextUrl.searchParams.get("id")?.trim();
  if (!id || id.length > 500) return NextResponse.json({ error: "Draft is required." }, { status: 400 });

  const { error } = await service
    .from("chillbros_staff_drafts")
    .delete()
    .eq("owner_profile_id", profile.id)
    .eq("draft_key", id);
  if (error) {
    console.error("[form-drafts] delete failed", { code: error.code, message: error.message });
    return NextResponse.json({ error: "Draft could not be deleted." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
