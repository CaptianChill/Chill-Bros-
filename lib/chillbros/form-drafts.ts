export const FORM_DRAFT_STORAGE_KEY = "chillbros-form-drafts-v2";

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
    const raw = window.localStorage.getItem(localStorageKey(profileId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeFormDrafts(profileId: string, drafts: FormDraft[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(localStorageKey(profileId), JSON.stringify(drafts.slice(0, 80)));
    window.dispatchEvent(new Event("chillbros:drafts-changed"));
  } catch {
    // Local storage is only an offline backup. A browser quota failure must not break the form.
  }
}

export function deleteFormDraft(profileId: string, id: string) {
  writeFormDrafts(profileId, readFormDrafts(profileId).filter((draft) => draft.id !== id));
}

export function upsertFormDraft(profileId: string, draft: FormDraft) {
  writeFormDrafts(profileId, mergeFormDrafts([draft], readFormDrafts(profileId)));
}

export async function readRemoteFormDrafts(filters: DraftFilters = {}): Promise<FormDraft[]> {
  try {
    const query = new URLSearchParams();
    if (filters.id) query.set("id", filters.id);
    if (filters.path) query.set("path", filters.path);
    if (filters.customerId) query.set("customerId", filters.customerId);
    const response = await fetch(`/api/form-drafts${query.size ? `?${query.toString()}` : ""}`, {
      credentials: "same-origin",
      cache: "no-store",
    });
    if (!response.ok) return [];
    const payload = await response.json() as { drafts?: FormDraft[] };
    return Array.isArray(payload.drafts) ? payload.drafts : [];
  } catch {
    return [];
  }
}

export async function upsertRemoteFormDraft(draft: FormDraft): Promise<boolean> {
  try {
    const response = await fetch("/api/form-drafts", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(draft),
    });
    return response.ok;
  } catch {
    return false;
  }
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
