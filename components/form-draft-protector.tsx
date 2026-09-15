"use client";

import { useEffect } from "react";

import {
  mergeFormDrafts,
  readFormDrafts,
  readRemoteFormDrafts,
  type FormDraft,
  type FormDraftField,
  upsertFormDraft,
  upsertRemoteFormDraft,
} from "@/lib/chillbros/form-drafts";

function cleanPath() {
  const url = new URL(window.location.href);
  for (const key of ["draft", "success", "error", "token", "invoice"]) url.searchParams.delete(key);
  const query = url.searchParams.toString();
  return `${url.pathname}${query ? `?${query}` : ""}`;
}

function draftableControls(form: HTMLFormElement) {
  return Array.from(form.elements).filter((control): control is HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement => {
    if (!(control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement || control instanceof HTMLSelectElement)) return false;
    if (!control.name || control.name.startsWith("$ACTION")) return false;
    if (control instanceof HTMLInputElement && ["password", "file", "submit", "button", "reset", "image"].includes(control.type)) return false;
    return true;
  });
}

function isDraftable(form: HTMLFormElement) {
  if (form.dataset.noDraft === "true") return false;
  if (!form.dataset.draftKey) return false;
  if (form.method.toLowerCase() === "get") return false;
  const action = form.getAttribute("action") || "";
  if (action.includes("/api/payments/stripe/checkout")) return false;
  return draftableControls(form).some((control) => !(control instanceof HTMLInputElement && control.type === "hidden"));
}

function inferCustomerId(form: HTMLFormElement) {
  const customerControl = draftableControls(form).find((control) => control.name === "customerId");
  const selected = customerControl?.value?.trim();
  if (selected) return selected;
  const match = window.location.pathname.match(/^\/customers\/([^/?#]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function inferLabel(form: HTMLFormElement) {
  if (form.dataset.draftLabel) return form.dataset.draftLabel;
  const section = form.closest("section, article, div");
  const heading = section?.querySelector("h1, h2, h3");
  const pageTitle = document.querySelector("main h1, main h2");
  return (heading?.textContent || pageTitle?.textContent || document.title || "Saved form").trim().slice(0, 120);
}

function serialize(form: HTMLFormElement): FormDraftField[] {
  const occurrences = new Map<string, number>();
  return draftableControls(form).map((control) => {
    const occurrence = occurrences.get(control.name) ?? 0;
    occurrences.set(control.name, occurrence + 1);
    if (control instanceof HTMLInputElement && (control.type === "checkbox" || control.type === "radio")) {
      return { name: control.name, type: control.type, value: control.value, checked: control.checked, occurrence };
    }
    return { name: control.name, type: control instanceof HTMLSelectElement ? "select" : control instanceof HTMLTextAreaElement ? "textarea" : control.type, value: control.value, occurrence };
  });
}

function restore(form: HTMLFormElement, draft: FormDraft) {
  const controls = draftableControls(form);
  for (const field of draft.fields) {
    const candidates = controls.filter((control) => control.name === field.name);
    let control = candidates[field.occurrence ?? 0] ?? candidates[0];
    if (field.type === "checkbox" || field.type === "radio") {
      control = candidates.find((candidate) => candidate instanceof HTMLInputElement && candidate.value === field.value) ?? control;
    }
    if (!control) continue;
    if (control instanceof HTMLInputElement && (control.type === "checkbox" || control.type === "radio")) control.checked = Boolean(field.checked);
    else control.value = field.value;
    control.dispatchEvent(new Event("input", { bubbles: true }));
    control.dispatchEvent(new Event("change", { bubbles: true }));
  }
}

export function FormDraftProtector({ profileId }: { profileId: string }) {
  useEffect(() => {
    const forms = Array.from(document.querySelectorAll<HTMLFormElement>("main form")).filter(isDraftable);
    if (!forms.length) return;

    const path = cleanPath();
    const requestedDraftId = new URL(window.location.href).searchParams.get("draft");
    const localRequestedDraft = requestedDraftId ? readFormDrafts(profileId).find((draft) => draft.id === requestedDraftId) : null;
    const requestedDraft = requestedDraftId
      ? readRemoteFormDrafts({ id: requestedDraftId }).then((remote) => mergeFormDrafts(localRequestedDraft ? [localRequestedDraft] : [], remote)[0] ?? null)
      : Promise.resolve<FormDraft | null>(null);
    const cleanups: Array<() => void> = [];
    let disposed = false;

    forms.forEach((form, formIndex) => {
      let saveButton: HTMLButtonElement;
      let queuedDraft: FormDraft | null = null;
      let activeSync: Promise<boolean> | null = null;

      const flushRemote = () => {
        if (activeSync) return activeSync;
        activeSync = (async () => {
          let synced = true;
          while (queuedDraft) {
            const nextDraft = queuedDraft;
            queuedDraft = null;
            synced = (await upsertRemoteFormDraft(nextDraft)) && synced;
          }
          return synced;
        })().finally(() => {
          activeSync = null;
          if (queuedDraft) void flushRemote();
        });
        return activeSync;
      };

      const save = async (explicit = false) => {
        const customerId = inferCustomerId(form);
        const draft: FormDraft = {
          id: form.dataset.draftKey || form.id || `form:${path}:${formIndex}`,
          path,
          label: inferLabel(form),
          customerId,
          formIndex,
          updatedAt: new Date().toISOString(),
          fields: serialize(form),
        };
        upsertFormDraft(profileId, draft);
        queuedDraft = draft;
        if (explicit && saveButton) saveButton.textContent = "Saving…";
        const savedToNeon = await flushRemote();
        if (explicit && saveButton && !disposed) {
          saveButton.textContent = savedToNeon ? "Saved ✓" : "Saved on device";
          window.setTimeout(() => {
            if (!disposed) saveButton.textContent = "Save Draft";
          }, 1800);
        }
      };

      const bar = document.createElement("div");
      bar.dataset.chillDraftBar = "true";
      bar.className = "mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-[#2d7dff]/15 pt-3";
      bar.style.gridColumn = "1 / -1";

      const note = document.createElement("span");
      note.className = "mr-auto text-[11px] text-zinc-500";
      note.textContent = "Changes autosave to Neon, with an offline copy on this device.";

      const backButton = document.createElement("button");
      backButton.type = "button";
      backButton.textContent = "← Back";
      backButton.className = "min-h-10 rounded-xl border border-[#2d7dff]/25 bg-black/35 px-4 py-2 text-xs font-semibold text-zinc-200 transition hover:border-[#8ffafa]/35";
      backButton.addEventListener("click", () => {
        void (async () => {
          await save(false);
          if (window.history.length > 1) window.history.back();
          else window.location.assign("/customers");
        })();
      });

      saveButton = document.createElement("button");
      saveButton.type = "button";
      saveButton.textContent = "Save Draft";
      saveButton.className = "min-h-10 rounded-xl border border-[#8ffafa]/45 bg-[#2d7dff]/10 px-4 py-2 text-xs font-semibold text-[#d9fbff] transition hover:bg-[#2d7dff]/20";
      saveButton.addEventListener("click", () => { void save(true); });

      bar.append(note, backButton, saveButton);
      form.appendChild(bar);

      let timer: number | undefined;
      const autosave = () => {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => { void save(false); }, 1200);
      };
      form.addEventListener("input", autosave);
      form.addEventListener("change", autosave);

      if (requestedDraftId) {
        void requestedDraft.then((draft) => {
          if (!disposed && draft && draft.id === (form.dataset.draftKey || form.id || `form:${path}:${formIndex}`) && draft.path === path) {
            window.setTimeout(() => {
              if (!disposed) restore(form, draft);
            }, 0);
          }
        });
      }

      cleanups.push(() => {
        window.clearTimeout(timer);
        form.removeEventListener("input", autosave);
        form.removeEventListener("change", autosave);
        bar.remove();
      });
    });

    return () => {
      disposed = true;
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [profileId]);

  return null;
}
