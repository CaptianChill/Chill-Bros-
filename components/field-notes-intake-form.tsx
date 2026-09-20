"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { Camera, Loader2, Send, Upload, X } from "lucide-react";

import { createFieldNoteSubmissionAction } from "@/lib/chillbros/field-notes-actions";
import { StatusPill } from "@/components/status-pill";

export type FieldJobOption = { id: string; customerId: string; customerName: string; location: string | null };
export type CustomerOption = { id: string; name: string };

/**
 * Presentation-facing configuration. A future BoodaForge shell can override
 * these labels/tokens without touching the submission logic below.
 */
export type FieldNotesIntakeTheme = {
  heading: string;
  subheading: string;
  sendLabel: string;
};

const DEFAULT_THEME: FieldNotesIntakeTheme = {
  heading: "Field Notes",
  subheading: "Photograph your handwritten notes and send them to the office.",
  sendLabel: "SEND TO OFFICE",
};

type PendingPhoto = { file: File; previewUrl: string };

export function FieldNotesIntakeForm({
  technicianName,
  jobs,
  customers,
  theme = DEFAULT_THEME,
  onSubmitted,
}: {
  technicianName: string;
  jobs: FieldJobOption[];
  customers: CustomerOption[];
  theme?: FieldNotesIntakeTheme;
  onSubmitted?: (result: { customerLabel: string; photoCount: number }) => void;
}) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [jobId, setJobId] = useState<string>(jobs[0]?.id ?? "");
  const [otherCustomer, setOtherCustomer] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<PendingPhoto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{ customerLabel: string; photoCount: number; submittedAt: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const selectedJob = useMemo(() => jobs.find((job) => job.id === jobId) ?? null, [jobs, jobId]);
  const matchedCustomer = useMemo(() => customers.find((customer) => customer.name.trim().toLowerCase() === customerName.trim().toLowerCase()) ?? null, [customers, customerName]);

  function addFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const next: PendingPhoto[] = [];
    for (const file of Array.from(fileList)) next.push({ file, previewUrl: URL.createObjectURL(file) });
    setPhotos((current) => [...current, ...next].slice(0, 10));
    setError(null);
  }

  function removePhoto(index: number) {
    setPhotos((current) => {
      const target = current[index];
      if (target) URL.revokeObjectURL(target.previewUrl);
      return current.filter((_, i) => i !== index);
    });
  }

  function handleSubmit() {
    setError(null);
    if (!otherCustomer && !selectedJob) { setError("Choose a customer/job, or switch to “Different customer”."); return; }
    if (otherCustomer && !customerName.trim()) { setError("Type the customer's name."); return; }
    if (photos.length === 0) { setError("Take or upload at least one photo of your notes."); return; }

    startTransition(async () => {
      const result = await createFieldNoteSubmissionAction(
        {
          customerId: otherCustomer ? matchedCustomer?.id ?? null : selectedJob?.customerId ?? null,
          customerNameFreeform: otherCustomer ? customerName.trim() : null,
          jobId: otherCustomer ? null : selectedJob?.id ?? null,
          equipmentId: null,
          technicianNote: note,
        },
        photos.map((photo) => photo.file),
      );

      if (!result.ok) { setError(result.error); return; }

      const customerLabel = otherCustomer ? customerName.trim() : selectedJob?.customerName ?? "Customer";
      const photoCount = photos.length;
      for (const photo of photos) URL.revokeObjectURL(photo.previewUrl);
      setPhotos([]);
      setNote("");
      setConfirmation({ customerLabel, photoCount, submittedAt: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) });
      onSubmitted?.({ customerLabel, photoCount });
    });
  }

  return (
    <div className="space-y-4 text-center">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-[#8ffafa]">{theme.heading}</p>
        <p className="mt-1 text-sm text-zinc-400">{theme.subheading}</p>
        <p className="mt-1 text-sm text-zinc-500">Technician: <span className="text-white">{technicianName}</span></p>
      </div>

      {confirmation ? (
        <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/5 p-4 text-sm text-emerald-100">
          <p className="font-medium">Notes sent to office.</p>
          <p className="mt-1 text-xs text-emerald-200/80">{confirmation.customerLabel} · {confirmation.photoCount} photo{confirmation.photoCount === 1 ? "" : "s"} · {confirmation.submittedAt}</p>
        </div>
      ) : null}

      {error ? <p className="rounded-xl border border-rose-500/20 bg-rose-500/5 px-3 py-2 text-xs text-rose-300">{error}</p> : null}

      <div className="rounded-2xl border border-[#2d7dff]/20 bg-black/40 p-4 text-left">
        <p className="mb-2 text-sm font-medium text-white">Customer / Job</p>
        {!otherCustomer ? (
          <>
            {jobs.length > 0 ? (
              <select value={jobId} onChange={(event) => setJobId(event.target.value)} className="w-full rounded-xl border border-[#2d7dff]/30 bg-black/60 px-3 py-3 text-base text-white">
                {jobs.map((job) => <option key={job.id} value={job.id}>{job.customerName}{job.location ? ` — ${job.location}` : ""}</option>)}
              </select>
            ) : <p className="text-sm text-zinc-500">No active field jobs assigned right now.</p>}
            <button type="button" onClick={() => setOtherCustomer(true)} className="mt-2 text-xs text-[#8ffafa] underline underline-offset-2">Different customer / no job yet</button>
          </>
        ) : (
          <>
            <input
              list="field-notes-customer-options"
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
              placeholder="Type the customer's name"
              className="w-full rounded-xl border border-[#2d7dff]/30 bg-black/60 px-3 py-3 text-base text-white placeholder:text-zinc-500"
            />
            <datalist id="field-notes-customer-options">{customers.map((customer) => <option key={customer.id} value={customer.name} />)}</datalist>
            {jobs.length > 0 ? <button type="button" onClick={() => setOtherCustomer(false)} className="mt-2 text-xs text-[#8ffafa] underline underline-offset-2">Back to my assigned jobs</button> : null}
          </>
        )}
      </div>

      <div className="rounded-2xl border border-[#2d7dff]/20 bg-black/40 p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium text-white">Notes photos</p>
          <StatusPill>{photos.length} added</StatusPill>
        </div>

        {photos.length > 0 ? (
          <div className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {photos.map((photo, index) => (
              <div key={photo.previewUrl} className="relative aspect-square overflow-hidden rounded-xl border border-[#2d7dff]/20 bg-black/60">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.previewUrl} alt={`Note page ${index + 1}`} className="h-full w-full object-cover" />
                <button type="button" onClick={() => removePhoto(index)} aria-label="Remove photo" className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white"><X className="h-3.5 w-3.5" /></button>
              </div>
            ))}
          </div>
        ) : null}

        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={(event) => { addFiles(event.target.files); event.target.value = ""; }} />
        <input ref={uploadInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(event) => { addFiles(event.target.files); event.target.value = ""; }} />
        <div className="grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={() => cameraInputRef.current?.click()} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-dashed border-[#2d7dff]/40 px-4 py-4 text-sm text-[#d9fbff] transition hover:bg-[#2d7dff]/10"><Camera className="h-5 w-5" />TAKE PHOTO</button>
          <button type="button" onClick={() => uploadInputRef.current?.click()} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-dashed border-[#2d7dff]/40 px-4 py-4 text-sm text-[#d9fbff] transition hover:bg-[#2d7dff]/10"><Upload className="h-5 w-5" />UPLOAD PHOTOS</button>
        </div>
      </div>

      <div className="rounded-2xl border border-[#2d7dff]/20 bg-black/40 p-4 text-left">
        <p className="mb-2 text-sm font-medium text-white">Optional additional note</p>
        <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} placeholder="Anything you want to add for the office..." className="w-full rounded-xl border border-[#2d7dff]/30 bg-black/60 px-3 py-2 text-sm text-white placeholder:text-zinc-500" />
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={pending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#2d7dff] px-4 py-4 text-base font-semibold uppercase tracking-[0.08em] text-white transition hover:bg-[#2d7dff]/85 disabled:opacity-60"
      >
        {pending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
        {pending ? "Sending…" : theme.sendLabel}
      </button>
    </div>
  );
}
