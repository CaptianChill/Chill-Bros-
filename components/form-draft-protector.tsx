"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  deleteFormDraft,
  deleteRemoteFormDraft,
  loadRemoteFormDrafts,
  mergeFormDrafts,
  readFormDrafts,
  saveRemoteFormDraft,
  type FormDraft,
  type FormDraftField,
  upsertFormDraft,
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
    if (!control.name || control.name.startsWith("$ACTION") || control.name === "draftId") return false;
    if (control instanceof HTMLInputElement && ["password", "file", "submit", "button", "reset", "image"].includes(control.type)) return false;
    return true;
  });
}

function isDraftable(form: HTMLFormElement) {
  if (form.hasAttribute("data-no-draft")) return false;
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
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const serializedSearchParams = searchParams.toString();

  useEffect(() => {
    const currentUrl = new URL(window.location.href);
    const pendingSubmitKey = `chillbros-submitted-draft:${profileId}`;
    if (currentUrl.searchParams.has("success")) {
      const submittedDraftId = window.sessionStorage.getItem(pendingSubmitKey);
      if (submittedDraftId) {
        window.sessionStorage.removeItem(pendingSubmitKey);
        deleteFormDraft(profileId, submittedDraftId);
        void deleteRemoteFormDraft(submittedDraftId);
      }
    }

    const forms = Array.from(document.querySelectorAll<HTMLFormElement>("main form")).filter(isDraftable);
    if (!forms.length) return;

    const path = cleanPath();
    const requestedDraftId = currentUrl.searchParams.get("draft");
    const localRequestedDraft = requestedDraftId ? readFormDrafts(profileId).find((draft) => draft.id === requestedDraftId) : null;
    let remoteWritable = !requestedDraftId;
    const requestedDraft = requestedDraftId
      ? loadRemoteFormDrafts({ id: requestedDraftId }).then((remote) => {
        remoteWritable = remote.ok;
        return mergeFormDrafts(localRequestedDraft ? [localRequestedDraft] : [], remote.drafts)[0] ?? null;
      })
      : Promise.resolve<FormDraft | null>(null);
    const cleanups: Array<() => void> = [];
    let disposed = false;

    forms.forEach((form, formIndex) => {
      let queuedDraft: FormDraft | null = null;
      let activeSync: Promise<boolean> | null = null;
      let dirty = false;
      let submitting = false;
      const draftPrefix = form.dataset.draftKey || form.id || `form:${path}:${formIndex}`;
      const draftId = requestedDraftId && (requestedDraftId === draftPrefix || requestedDraftId.startsWith(`${draftPrefix}:`))
        ? requestedDraftId
        : `${draftPrefix}:${crypto.randomUUID()}`;

      const draftIdInput = document.createElement("input");
      draftIdInput.type = "hidden";
      draftIdInput.name = "draftId";
      draftIdInput.value = draftId;
      form.appendChild(draftIdInput);

      const flushRemote = () => {
        if (!remoteWritable) return Promise.resolve(false);
        if (activeSync) return activeSync;
        activeSync = (async () => {
          let synced = true;
          while (queuedDraft) {
            const nextDraft = queuedDraft;
            queuedDraft = null;
            const saved = await saveRemoteFormDraft(nextDraft);
            if (saved) upsertFormDraft(profileId, saved);
            synced = Boolean(saved) && synced;
          }
          return synced;
        })().finally(() => {
          activeSync = null;
          if (queuedDraft) void flushRemote();
        });
        return activeSync;
      };

      const snapshot = () => {
        const customerId = inferCustomerId(form);
        const draft: FormDraft = {
          id: draftId,
          path,
          label: inferLabel(form),
          customerId,
          formIndex,
          updatedAt: new Date().toISOString(),
          fields: serialize(form),
        };
        const savedLocally = upsertFormDraft(profileId, draft);
        queuedDraft = draft;
        return { draft, savedLocally };
      };

      const save = async (explicit = false) => {
        const { savedLocally } = snapshot();
        if (explicit && saveButton) saveButton.textContent = "Saving…";
        const savedToNeon = await flushRemote();
        if (explicit && saveButton && !disposed) {
          saveButton.textContent = savedToNeon ? "Saved ✓" : savedLocally ? "Saved on device" : "Draft save failed";
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
          else router.push("/customers");
        })();
      });

      const saveButton = document.createElement("button");
      saveButton.type = "button";
      saveButton.textContent = "Save Draft";
      saveButton.className = "min-h-10 rounded-xl border border-[#8ffafa]/45 bg-[#2d7dff]/10 px-4 py-2 text-xs font-semibold text-[#d9fbff] transition hover:bg-[#2d7dff]/20";
      saveButton.addEventListener("click", () => { void save(true); });

      bar.append(note, backButton, saveButton);
      form.appendChild(bar);

      let timer: number | undefined;
      const autosave = () => {
        dirty = true;
        snapshot();
        window.clearTimeout(timer);
        timer = window.setTimeout(() => { void flushRemote(); }, 1200);
      };
      const submit = (event: SubmitEvent) => {
        if (submitting || form.hasAttribute("data-no-draft")) return;
        event.preventDefault();
        submitting = true;
        dirty = true;
        window.clearTimeout(timer);
        const { draft } = snapshot();
        window.sessionStorage.setItem(pendingSubmitKey, draft.id);
        const submitter = event.submitter instanceof HTMLElement ? event.submitter : undefined;
        void Promise.race([flushRemote(), new Promise<boolean>((resolve) => window.setTimeout(() => resolve(false), 2000))]).catch((error) => { console.error("Draft sync failed", error); }).finally(() => {
          if (submitter) form.requestSubmit(submitter);
          else form.requestSubmit();
        });
      };
      const pagehide = () => {
        if (!dirty || submitting) return;
        const { draft } = snapshot();
        if (remoteWritable) {
          const body = new Blob([JSON.stringify(draft)], { type: "application/json" });
          navigator.sendBeacon("/api/form-drafts", body);
        }
      };
      const saveFromHeader = () => { void save(true); };
      form.addEventListener("input", autosave);
      form.addEventListener("change", autosave);
      form.addEventListener("submit", submit);
      window.addEventListener("pagehide", pagehide);
      window.addEventListener("chillbros-save", saveFromHeader);

      if (requestedDraftId) {
        void requestedDraft.then((draft) => {
          if (!disposed && draft && draft.id === draftId && draft.path === path) {
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
        form.removeEventListener("submit", submit);
        window.removeEventListener("pagehide", pagehide);
        window.removeEventListener("chillbros-save", saveFromHeader);
        draftIdInput.remove();
        bar.remove();
      });
    });

    return () => {
      disposed = true;
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [pathname, profileId, router, serializedSearchParams]);

  return null;
}
