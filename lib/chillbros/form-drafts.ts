export const FORM_DRAFT_STORAGE_KEY = "chillbros-form-drafts-v1";

export type FormDraftField = {
  name: string;
  type: string;
  value: string;
  checked?: boolean;
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

export function readFormDrafts(): FormDraft[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(FORM_DRAFT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeFormDrafts(drafts: FormDraft[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(FORM_DRAFT_STORAGE_KEY, JSON.stringify(drafts.slice(0, 80)));
    window.dispatchEvent(new Event("chillbros:drafts-changed"));
  } catch {
    // Browser storage can be unavailable or full. Draft saving must never break the form itself.
  }
}

export function deleteFormDraft(id: string) {
  writeFormDrafts(readFormDrafts().filter((draft) => draft.id !== id));
}

export function upsertFormDraft(draft: FormDraft) {
  const drafts = readFormDrafts().filter((item) => item.id !== draft.id);
  writeFormDrafts([draft, ...drafts].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
}

export function withDraftParam(path: string, draftId: string) {
  const url = new URL(path, "https://chillbros.local");
  url.searchParams.set("draft", draftId);
  return `${url.pathname}${url.search}${url.hash}`;
}
