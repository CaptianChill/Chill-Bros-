"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, Clipboard, Pencil, RefreshCw, X } from "lucide-react";

import {
  approveFieldNoteSubmissionAction,
  completeFieldNoteSubmissionAction,
  retryFieldNoteProcessingAction,
  updateFieldNoteSubmissionAction,
  type FieldNoteEditableFields,
} from "@/lib/chillbros/field-notes-actions";
import type { FieldNoteMaterial, FieldNoteSubmission } from "@/lib/chillbros/field-notes-types";
import { FIELD_NOTE_STATUS_LABELS } from "@/lib/chillbros/field-notes-types";
import { FieldNoteLinks } from "./field-note-links";
import { StatusPill } from "@/components/status-pill";

const STATUS_TONE = {
  submitted: "cyan",
  processing: "cyan",
  needs_review: "amber",
  ready: "cyan",
  approved: "emerald",
  completed: "emerald",
  processing_failed: "rose",
} as const;

function EditableField({ label, value, onChange, rows = 3 }: { label: string; value: string; onChange: (next: string) => void; rows?: number }) {
  return (
    <label className="block text-left">
      <span className="mb-1 block text-xs uppercase tracking-[0.16em] text-zinc-500">{label}</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={rows} className="w-full rounded-xl border border-[#2d7dff]/25 bg-black/50 px-3 py-2 text-sm text-white" />
    </label>
  );
}

export function FieldNotesReviewPanel({ submission, customers }: { submission: FieldNoteSubmission; customers: { id: string; name: string }[] }) {
  const router = useRouter();
  const [reviewed, setReviewed] = useState(false);
  const editable = ["ready", "needs_review", "processing_failed"].includes(submission.status);
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<"internal" | "customer" | "invoice" | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const [form, setForm] = useState<FieldNoteEditableFields>({
    customerComplaint: submission.customerComplaint ?? "",
    diagnosis: submission.diagnosis ?? "",
    workPerformed: submission.workPerformed ?? "",
    materials: submission.materials,
    laborHours: submission.laborHours,
    driveHours: submission.driveHours,
    equipmentStatus: submission.equipmentStatus ?? "",
    recommendations: submission.recommendations ?? "",
    followUpRequired: submission.followUpRequired,
    cleanedInternalNotes: submission.cleanedInternalNotes ?? "",
    customerSummary: submission.customerSummary ?? "",
    invoiceDescription: submission.invoiceDescription ?? "",
  });

  const flaggedFields = new Set(submission.confidenceFlags.map((flag) => flag.field));

  function updateMaterial(index: number, patch: Partial<FieldNoteMaterial>) {
    setForm((current) => ({ ...current, materials: (current.materials ?? []).map((material, i) => (i === index ? { ...material, ...patch } : material)) }));
  }

  function addMaterial() {
    setForm((current) => ({ ...current, materials: [...(current.materials ?? []), { description: "", quantity: "1", partNumber: null, confidence: "high" }] }));
  }

  function removeMaterial(index: number) {
    setForm((current) => ({ ...current, materials: (current.materials ?? []).filter((_, i) => i !== index) }));
  }

  function saveEdits() {
    setError(null);
    startTransition(async () => {
      try {
      const result = await updateFieldNoteSubmissionAction(submission.id, form, submission.updatedAt);
      if (!result.ok) { setError(result.error); router.refresh(); return; }
      setEditing(false);
      router.refresh();
      } catch { setError("The connection was interrupted. Refresh to check the saved status before retrying."); }
    });
  }

  function approve() {
    setError(null);
    startTransition(async () => {
      try {
      const result = await approveFieldNoteSubmissionAction(submission.id, submission.updatedAt, reviewed);
      if (!result.ok) { setError(result.error); router.refresh(); return; }
      router.refresh();
      } catch { setError("The connection was interrupted. Refresh to check the saved status before retrying."); }
    });
  }

  function complete() {
    setError(null);
    startTransition(async () => {
      try {
      const result = await completeFieldNoteSubmissionAction(submission.id, submission.updatedAt);
      if (!result.ok) { setError(result.error); router.refresh(); return; }
      router.refresh();
      } catch { setError("The connection was interrupted. Refresh to check the saved status before retrying."); }
    });
  }

  function retry() {
    setError(null);
    startTransition(async () => {
      try {
      const result = await retryFieldNoteProcessingAction(submission.id);
      if (!result.ok) { setError(result.error); router.refresh(); return; }
      router.refresh();
      } catch { setError("The connection was interrupted. Refresh to check the saved status before retrying."); }
    });
  }

  async function copy(kind: "internal" | "customer" | "invoice") {
    const text = kind === "invoice" ? submission.invoiceDescription ?? "" : kind === "internal" ? submission.cleanedInternalNotes ?? "" : submission.customerSummary ?? "";
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setError("Could not copy to clipboard.");
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-4">
        <div className="rounded-2xl border border-[#2d7dff]/20 bg-black/40 p-4 text-left">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-medium text-white">{submission.customerName ?? submission.customerNameFreeform ?? "Unlinked customer"}</p>
              <p className="text-xs text-zinc-400">From {submission.technicianName} · Submitted {new Date(submission.submittedAt).toLocaleString()}</p>
            </div>
            <StatusPill tone={STATUS_TONE[submission.status]}>{FIELD_NOTE_STATUS_LABELS[submission.status]}</StatusPill>
          </div>
          {submission.technicianNote ? <p className="rounded-xl border border-[#2d7dff]/15 bg-black/30 p-2 text-sm text-zinc-300">Technician note: {submission.technicianNote}</p> : null}
        </div>

        <div className="rounded-2xl border border-[#2d7dff]/20 bg-black/40 p-4">
          <p className="mb-3 text-sm font-medium text-white">Attached photos ({submission.images.length})</p>
          <div className="grid grid-cols-2 gap-2">
            {submission.images.map((image) => image.url ? (
              <button key={image.id} type="button" onClick={() => setPreview(image.url)} className="relative aspect-[3/4] overflow-hidden rounded-xl border border-[#2d7dff]/20 bg-black/60">
                <Image src={image.url} alt={image.filename ?? `Page ${image.pageNumber}`} fill className="object-cover" unoptimized />
              </button>
            ) : null)}
          </div>
        </div>

        {["submitted", "processing", "processing_failed"].includes(submission.status) ? (
          <div className="rounded-2xl border border-rose-500/25 bg-rose-500/5 p-4 text-left">
            <p className="flex items-center gap-2 text-sm font-medium text-rose-200"><AlertTriangle className="h-4 w-4" />Processing status</p>
            <p className="mt-1 text-xs text-rose-200/80">{submission.aiError}</p>
            <button type="button" onClick={retry} disabled={pending} className="mt-3 inline-flex items-center gap-2 rounded-xl border border-rose-400/40 px-3 py-2 text-xs text-rose-100"><RefreshCw className="h-3.5 w-3.5" />Retry AI processing</button>
          </div>
        ) : null}

        {submission.confidenceFlags.length > 0 ? (
          <div className="rounded-2xl border border-amber-400/30 bg-amber-400/5 p-4 text-left">
            <p className="flex items-center gap-2 text-sm font-medium text-amber-100"><AlertTriangle className="h-4 w-4" />Needs your review</p>
            <ul className="mt-2 space-y-1.5">
              {submission.confidenceFlags.map((flag, index) => (
                <li key={`${flag.field}-${index}`} className="text-xs text-amber-100/90"><span className="font-semibold">{flag.field}:</span> recorded as &quot;{flag.value}&quot; — {flag.reason}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="rounded-2xl border border-[#2d7dff]/20 bg-black/40 p-4 text-left">
          <p className="mb-2 text-sm font-medium text-white">Raw transcription</p>
          <p className="whitespace-pre-wrap text-sm text-zinc-300">{submission.rawTranscription ?? "Not yet processed."}</p>
        </div>

        <div className="rounded-2xl border border-[#2d7dff]/20 bg-black/40 p-4 text-left">
          <p className="mb-2 text-sm font-medium text-white">Audit trail</p>
          <ul className="space-y-1.5">
            {submission.events.map((event) => (
              <li key={event.id} className="text-xs text-zinc-400"><span className="text-zinc-500">{new Date(event.createdAt).toLocaleString()}</span> — {event.message}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="space-y-4">
        {error ? <p className="rounded-xl border border-rose-500/20 bg-rose-500/5 px-3 py-2 text-xs text-rose-300">{error}</p> : null}

        <div className="flex flex-wrap gap-2">
          {!editing && editable ? (
            <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-2 rounded-xl border border-[#2d7dff]/30 px-3 py-2 text-xs text-[#d9fbff]"><Pencil className="h-3.5 w-3.5" />Edit</button>
          ) : editing ? (
            <>
              <button type="button" onClick={saveEdits} disabled={pending} className="inline-flex items-center gap-2 rounded-xl bg-[#2d7dff] px-3 py-2 text-xs font-medium text-white"><Check className="h-3.5 w-3.5" />Save</button>
              <button type="button" disabled={pending} onClick={() => { setForm({ customerComplaint: submission.customerComplaint ?? "", diagnosis: submission.diagnosis ?? "", workPerformed: submission.workPerformed ?? "", materials: submission.materials, laborHours: submission.laborHours, driveHours: submission.driveHours, equipmentStatus: submission.equipmentStatus ?? "", recommendations: submission.recommendations ?? "", followUpRequired: submission.followUpRequired, cleanedInternalNotes: submission.cleanedInternalNotes ?? "", customerSummary: submission.customerSummary ?? "", invoiceDescription: submission.invoiceDescription ?? "" }); setEditing(false); }} className="inline-flex items-center gap-2 rounded-xl border border-[#2d7dff]/20 px-3 py-2 text-xs text-zinc-300"><X className="h-3.5 w-3.5" />Cancel</button>
            </>
          ) : null}
          <button type="button" disabled={editing || pending} onClick={() => copy("internal")} className="inline-flex items-center gap-2 rounded-xl border border-[#2d7dff]/30 px-3 py-2 text-xs text-[#d9fbff]"><Clipboard className="h-3.5 w-3.5" />{copied === "internal" ? "Copied" : "Copy Notes"}</button>
          <button type="button" disabled={editing || pending} onClick={() => copy("customer")} className="inline-flex items-center gap-2 rounded-xl border border-[#2d7dff]/30 px-3 py-2 text-xs text-[#d9fbff]"><Clipboard className="h-3.5 w-3.5" />{copied === "customer" ? "Copied" : "Customer Version"}</button>
          <button type="button" disabled={editing || pending || !["approved", "completed"].includes(submission.status)} onClick={() => copy("invoice")} className="min-h-11 rounded-xl border border-cyan-800 px-3 text-xs">{copied === "invoice" ? "Copied" : "Copy approved invoice description"}</button>
          {editable ? (
            <button type="button" onClick={approve} disabled={pending || editing || !reviewed} className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-100"><Check className="h-3.5 w-3.5" />Approve</button>
          ) : null}
          {submission.status === "approved" || (submission.status === "completed" && submission.images.length > 0) ? (
            <button type="button" onClick={complete} disabled={pending} className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-100"><Check className="h-3.5 w-3.5" />{submission.status === "completed" ? "Retry photo cleanup" : "Complete & remove photos"}</button>
          ) : null}
        </div>

        {editable ? <><label className="flex items-start gap-2 rounded-xl border border-cyan-900 p-3 text-sm"><input type="checkbox" disabled={editing || pending} checked={reviewed} onChange={e => setReviewed(e.target.checked)} />I checked the saved text and all flagged technical values against the original notes and photos.</label><FieldNoteLinks submission={submission} customers={customers} disabled={editing || pending} /></> : null}
        {submission.status === "approved" ? <p className="text-sm text-emerald-200">The reviewed text is saved and locked. Complete keeps this service record and removes its temporary photos.</p> : null}
        {submission.status === "completed" && !submission.images.length ? <p className="text-sm text-emerald-200">Verified text is saved. Temporary photos have been removed.</p> : null}
        {editing ? (
          <div className="space-y-3 rounded-2xl border border-[#2d7dff]/20 bg-black/40 p-4">
            <EditableField label="Customer complaint" value={form.customerComplaint ?? ""} onChange={(v) => setForm((c) => ({ ...c, customerComplaint: v }))} />
            <EditableField label="Diagnosis" value={form.diagnosis ?? ""} onChange={(v) => setForm((c) => ({ ...c, diagnosis: v }))} />
            <EditableField label="Work performed" value={form.workPerformed ?? ""} onChange={(v) => setForm((c) => ({ ...c, workPerformed: v }))} />

            <div className="text-left">
              <p className="mb-1 text-xs uppercase tracking-[0.16em] text-zinc-500">Materials</p>
              <div className="space-y-2">
                {(form.materials ?? []).map((material, index) => (
                  <div key={index} className="grid grid-cols-[2fr_1fr_1fr_auto] items-center gap-1.5">
                    <input value={material.description} onChange={(event) => updateMaterial(index, { description: event.target.value })} placeholder="Description" className="rounded-lg border border-[#2d7dff]/25 bg-black/50 px-2 py-1.5 text-xs text-white" />
                    <input value={material.quantity} onChange={(event) => updateMaterial(index, { quantity: event.target.value })} placeholder="Qty" className="rounded-lg border border-[#2d7dff]/25 bg-black/50 px-2 py-1.5 text-xs text-white" />
                    <input value={material.partNumber ?? ""} onChange={(event) => updateMaterial(index, { partNumber: event.target.value || null })} placeholder="Part #" className="rounded-lg border border-[#2d7dff]/25 bg-black/50 px-2 py-1.5 text-xs text-white" />
                    <button type="button" onClick={() => removeMaterial(index)} aria-label="Remove material" className="rounded-lg border border-rose-400/30 p-1.5 text-rose-300"><X className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
              </div>
              <button type="button" onClick={addMaterial} className="mt-2 text-xs text-[#8ffafa] underline underline-offset-2">Add material</button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="text-left">
                <p className={`mb-1 text-xs uppercase tracking-[0.16em] ${flaggedFields.has("labor_hours") ? "text-amber-300" : "text-zinc-500"}`}>Labor hours</p>
                <input type="number" step="0.1" value={form.laborHours ?? ""} onChange={(event) => setForm((c) => ({ ...c, laborHours: event.target.value === "" ? null : Number(event.target.value) }))} className="w-full rounded-xl border border-[#2d7dff]/25 bg-black/50 px-3 py-2 text-sm text-white" />
              </div>
              <div className="text-left">
                <p className={`mb-1 text-xs uppercase tracking-[0.16em] ${flaggedFields.has("drive_hours") ? "text-amber-300" : "text-zinc-500"}`}>Drive hours</p>
                <input type="number" step="0.1" value={form.driveHours ?? ""} onChange={(event) => setForm((c) => ({ ...c, driveHours: event.target.value === "" ? null : Number(event.target.value) }))} className="w-full rounded-xl border border-[#2d7dff]/25 bg-black/50 px-3 py-2 text-sm text-white" />
              </div>
            </div>

            <EditableField label="Equipment status" value={form.equipmentStatus ?? ""} onChange={(v) => setForm((c) => ({ ...c, equipmentStatus: v }))} rows={2} />
            <EditableField label="Recommendations" value={form.recommendations ?? ""} onChange={(v) => setForm((c) => ({ ...c, recommendations: v }))} rows={2} />

            <label className="flex items-center gap-2 text-left text-sm text-zinc-300">
              <input type="checkbox" checked={form.followUpRequired ?? false} onChange={(event) => setForm((c) => ({ ...c, followUpRequired: event.target.checked }))} />
              Follow-up required
            </label>

            <EditableField label="Internal notes (office / technician)" value={form.cleanedInternalNotes ?? ""} onChange={(v) => setForm((c) => ({ ...c, cleanedInternalNotes: v }))} rows={5} />
            <EditableField label="Invoice description" value={form.invoiceDescription ?? ""} onChange={(v) => setForm((c) => ({ ...c, invoiceDescription: v }))} />
            <EditableField label="Customer-facing summary" value={form.customerSummary ?? ""} onChange={(v) => setForm((c) => ({ ...c, customerSummary: v }))} rows={5} />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-2xl border border-[#2d7dff]/20 bg-black/40 p-4 text-left">
              <p className="mb-2 text-sm font-medium text-white">Internal notes</p>
              <p className="whitespace-pre-wrap text-sm text-zinc-300">{form.cleanedInternalNotes || "Not yet available."}</p>
            </div>
            <div className="rounded-2xl border border-[#2d7dff]/20 bg-black/40 p-4 text-left">
              <p className="mb-2 text-sm font-medium text-white">Customer-facing summary</p>
              <p className="whitespace-pre-wrap text-sm text-zinc-300">{form.customerSummary || "Not yet available."}</p>
            </div>
            <div className="rounded-xl border border-cyan-900 p-3 text-left"><p className="text-sm font-medium">Invoice description</p><p className="whitespace-pre-wrap text-sm text-zinc-300">{form.invoiceDescription || "Not yet available."}</p></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-[#2d7dff]/20 bg-black/40 p-3 text-left"><p className={`text-xs uppercase tracking-[0.16em] ${flaggedFields.has("labor_hours") ? "text-amber-300" : "text-zinc-500"}`}>Labor hours</p><p className="mt-1 text-white">{form.laborHours ?? "—"}</p></div>
              <div className="rounded-2xl border border-[#2d7dff]/20 bg-black/40 p-3 text-left"><p className={`text-xs uppercase tracking-[0.16em] ${flaggedFields.has("drive_hours") ? "text-amber-300" : "text-zinc-500"}`}>Drive hours</p><p className="mt-1 text-white">{form.driveHours ?? "—"}</p></div>
            </div>
          </div>
        )}
      </div>

      {preview ? (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/90 p-3 backdrop-blur-md sm:p-6" role="dialog" aria-modal="true" onMouseDown={(event) => { if (event.currentTarget === event.target) setPreview(null); }}>
          <div className="relative h-[82dvh] w-full max-w-4xl overflow-hidden rounded-3xl border border-[#2d7dff]/40 bg-black">
            <Image src={preview} alt="Field note page" fill className="object-contain" unoptimized priority />
            <button type="button" onClick={() => setPreview(null)} className="absolute right-3 top-3 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black/70 text-white"><X className="h-5 w-5" /></button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
