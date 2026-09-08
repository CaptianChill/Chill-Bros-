"use client";

import { useEffect } from "react";

import { readFormDrafts, type FormDraft, type FormDraftField, upsertFormDraft } from "@/lib/chillbros/form-drafts";

function cleanPath() {
  const url = new URL(window.location.href);
  url.searchParams.delete("draft");
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
  if ((form.getAttribute("method") || "").toLowerCase() === "get") return false;
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
  return draftableControls(form).map((control) => {
    if (control instanceof HTMLInputElement && (control.type === "checkbox" || control.type === "radio")) {
      return { name: control.name, type: control.type, value: control.value, checked: control.checked };
    }
    return { name: control.name, type: control instanceof HTMLSelectElement ? "select" : control instanceof HTMLTextAreaElement ? "textarea" : control.type, value: control.value };
  });
}

function restore(form: HTMLFormElement, draft: FormDraft) {
  const controls = draftableControls(form);
  for (const field of draft.fields) {
    const candidates = controls.filter((control) => control.name === field.name);
    let control = candidates[0];
    if (field.type === "checkbox" || field.type === "radio") control = candidates.find((candidate) => candidate instanceof HTMLInputElement && candidate.value === field.value) || candidates[0];
    if (!control) continue;
    if (control instanceof HTMLInputElement && (control.type === "checkbox" || control.type === "radio")) control.checked = Boolean(field.checked);
    else control.value = field.value;
    control.dispatchEvent(new Event("input", { bubbles: true }));
    control.dispatchEvent(new Event("change", { bubbles: true }));
  }
}

export function FormDraftProtector() {
  useEffect(() => {
    const forms = Array.from(document.querySelectorAll<HTMLFormElement>("main form")).filter(isDraftable);
    if (!forms.length) return;

    const path = cleanPath();
    const requestedDraftId = new URL(window.location.href).searchParams.get("draft");
    const requestedDraft = requestedDraftId ? readFormDrafts().find((draft) => draft.id === requestedDraftId) : null;
    const cleanups: Array<() => void> = [];

    forms.forEach((form, formIndex) => {
      let saveButton: HTMLButtonElement;
      const save = (explicit = false) => {
        const customerId = inferCustomerId(form);
        const draft: FormDraft = {
          id: `form:${path}:${formIndex}`,
          path,
          label: inferLabel(form),
          customerId,
          formIndex,
          updatedAt: new Date().toISOString(),
          fields: serialize(form),
        };
        upsertFormDraft(draft);
        if (explicit && saveButton) {
          saveButton.textContent = "Saved ✓";
          window.setTimeout(() => { saveButton.textContent = "Save Draft"; }, 1600);
        }
      };

      const bar = document.createElement("div");
      bar.dataset.chillDraftBar = "true";
      bar.className = "mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-[#2d7dff]/15 pt-3";
      bar.style.gridColumn = "1 / -1";

      const note = document.createElement("span");
      note.className = "mr-auto text-[11px] text-zinc-500";
      note.textContent = "Changes also autosave on this device.";

      const backButton = document.createElement("button");
      backButton.type = "button";
      backButton.textContent = "← Back";
      backButton.className = "min-h-10 rounded-xl border border-[#2d7dff]/25 bg-black/35 px-4 py-2 text-xs font-semibold text-zinc-200 transition hover:border-[#8ffafa]/35";
      backButton.addEventListener("click", () => {
        save(false);
        if (window.history.length > 1) window.history.back();
        else window.location.assign("/customers");
      });

      saveButton = document.createElement("button");
      saveButton.type = "button";
      saveButton.textContent = "Save Draft";
      saveButton.className = "min-h-10 rounded-xl border border-[#8ffafa]/45 bg-[#2d7dff]/10 px-4 py-2 text-xs font-semibold text-[#d9fbff] transition hover:bg-[#2d7dff]/20";
      saveButton.addEventListener("click", () => save(true));

      bar.append(note, backButton, saveButton);
      form.appendChild(bar);

      let timer: number | undefined;
      const autosave = () => {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => save(false), 1200);
      };
      form.addEventListener("input", autosave);
      form.addEventListener("change", autosave);

      if (requestedDraft && requestedDraft.formIndex === formIndex && requestedDraft.path === path) {
        window.setTimeout(() => restore(form, requestedDraft), 0);
      }

      cleanups.push(() => {
        window.clearTimeout(timer);
        form.removeEventListener("input", autosave);
        form.removeEventListener("change", autosave);
        bar.remove();
      });
    });

    return () => cleanups.forEach((cleanup) => cleanup());
  }, []);

  return null;
}
