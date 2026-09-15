export const FORM_DRAFT_STORAGE_KEY = "chillbros-form-drafts-v2";
const LEGACY_FORM_DRAFT_STORAGE_KEY = "chillbros-form-drafts-v1";

function localStorageKey(profileId: string) {
  return `${FORM_DRAFT_STORAGE_KEY}:${profileId}`;
}

export type FormDraftField = {
  name: string;
  type: string;
  value: string;
  checked?: boolean;
  occurrence?: number;
};

export type FormDraft = {
  id: string;
  path: string;
  label: string;
  customerId: string | null;
  formIndex: number;
  updatedAt: string;
  fields: FormDraftField[];
};

type DraftFilters = { id?: string; path?: string; customerId?: string };
export type RemoteDraftResult = { ok: true; drafts: FormDraft[] } | { ok: false; drafts: [] };

function isFormDraft(value: unknown): value is FormDraft {
  if (!value || typeof value !== "object") return false;
  const draft = value as Partial<FormDraft>;
  return typeof draft.id === "string"
    && typeof draft.path === "string"
    && typeof draft.label === "string"
    && typeof draft.formIndex === "number"
    && typeof draft.updatedAt === "string"
    && Array.isArray(draft.fields)
    && draft.fields.every((field) => Boolean(field)
      && typeof field === "object"
      && typeof (field as FormDraftField).name === "string"
      && typeof (field as FormDraftField).type === "string"
      && typeof (field as FormDraftField).value === "string");
}

export function mergeFormDrafts(...groups: FormDraft[][]): FormDraft[] {
  const byId = new Map<string, FormDraft>();
  for (const draft of groups.flat()) {
    const current = byId.get(draft.id);
    if (!current || current.updatedAt < draft.updatedAt) byId.set(draft.id, draft);
  }
  return Array.from(byId.values()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 80);
}

export function readFormDrafts(profileId: string): FormDraft[] {
  if (typeof window === "undefined") return [];
  try {
    const key = localStorageKey(profileId);
    let raw = window.localStorage.getItem(key);
    if (!raw) {
      const legacy = window.localStorage.getItem(LEGACY_FORM_DRAFT_STORAGE_KEY);
      if (legacy) {
        raw = legacy;
        try {
          window.localStorage.setItem(key, legacy);
          window.localStorage.removeItem(LEGACY_FORM_DRAFT_STORAGE_KEY);
        } catch {
          // The legacy value can still be read even when storage is full.
        }
      }
    }
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isFormDraft).slice(0, 80) : [];
  } catch {
    return [];
  }
}

export function writeFormDrafts(profileId: string, drafts: FormDraft[]): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(localStorageKey(profileId), JSON.stringify(drafts.slice(0, 80)));
    window.dispatchEvent(new Event("chillbros:drafts-changed"));
    return true;
  } catch {
    // Local storage is only an offline backup. A browser quota failure must not break the form.
    return false;
  }
}

export function deleteFormDraft(profileId: string, id: string): boolean {
  return writeFormDrafts(profileId, readFormDrafts(profileId).filter((draft) => draft.id !== id));
}

export function upsertFormDraft(profileId: string, draft: FormDraft): boolean {
  return writeFormDrafts(profileId, mergeFormDrafts([draft], readFormDrafts(profileId)));
}

export async function loadRemoteFormDrafts(filters: DraftFilters = {}, signal?: AbortSignal): Promise<RemoteDraftResult> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 5000);
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  try {
    const query = new URLSearchParams();
    if (filters.id) query.set("id", filters.id);
    if (filters.path) query.set("path", filters.path);
    if (filters.customerId) query.set("customerId", filters.customerId);
    const response = await fetch(`/api/form-drafts${query.size ? `?${query.toString()}` : ""}`, {
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) return { ok: false, drafts: [] };
    const payload = await response.json() as { drafts?: FormDraft[] };
    return { ok: true, drafts: Array.isArray(payload.drafts) ? payload.drafts.filter(isFormDraft) : [] };
  } catch {
    return { ok: false, drafts: [] };
  } finally {
    window.clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}

export async function readRemoteFormDrafts(filters: DraftFilters = {}, signal?: AbortSignal): Promise<FormDraft[]> {
  return (await loadRemoteFormDrafts(filters, signal)).drafts;
}

export async function saveRemoteFormDraft(draft: FormDraft): Promise<FormDraft | null> {
  try {
    const response = await fetch("/api/form-drafts", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(draft),
    });
    if (!response.ok) return null;
    const payload = await response.json() as { draft?: FormDraft };
    return isFormDraft(payload.draft) ? payload.draft : null;
  } catch {
    return null;
  }
}

export async function upsertRemoteFormDraft(draft: FormDraft): Promise<boolean> {
  return Boolean(await saveRemoteFormDraft(draft));
}

export async function deleteRemoteFormDraft(id: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/form-drafts?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "same-origin",
    });
    return response.ok;
  } catch {
    return false;
  }
}

export function withDraftParam(path: string, draftId: string) {
  const url = new URL(path, "https://chillbros.local");
  url.searchParams.set("draft", draftId);
  return `${url.pathname}${url.search}${url.hash}`;
}
