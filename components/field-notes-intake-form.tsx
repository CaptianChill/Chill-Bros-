"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Camera, Upload, X } from "lucide-react";
import { finishFieldNoteSubmissionAction, prepareFieldNoteSubmissionAction } from "@/lib/chillbros/field-notes-actions";
import { prepareNotePhoto, readFieldNoteDraft, saveFieldNoteDraft, type FieldNoteDraft } from "@/lib/chillbros/field-note-draft";

export type FieldJobOption = { id: string; customerId: string; customerName: string; location: string | null };
export type CustomerOption = { id: string; name: string };
export type FieldNotesIntakeTheme = { heading: string; subheading: string; sendLabel: string };
const defaultTheme = { heading: "Field Notes", subheading: "Type your notes, add photos, and send them to the office for review.", sendLabel: "SEND TO OFFICE" };
const inputClass = "w-full rounded-xl border border-cyan-800 bg-black/60 px-3 py-3 text-base text-white";

export function FieldNotesIntakeForm({ technicianName, profileId, jobs, customers, equipment = [], theme = defaultTheme, onSubmitted }: {
  technicianName: string; profileId: string; jobs: FieldJobOption[]; customers: CustomerOption[];
  equipment?: { id: string; customerId: string; label: string }[];
  theme?: FieldNotesIntakeTheme; onSubmitted?: (result: { customerLabel: string; photoCount: number }) => void;
}) {
  const router = useRouter();
  const camera = useRef<HTMLInputElement>(null); const upload = useRef<HTMLInputElement>(null);
  const busyRef = useRef(false);
  const [draft, setDraft] = useState<FieldNoteDraft | null>(null);
  const [busy, setBusy] = useState(false); const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null); const [storageWarning, setStorageWarning] = useState(false);
  const [confirmation, setConfirmation] = useState(""); const [previews, setPreviews] = useState<string[]>([]);
  const initialJobId = jobs[0]?.id ?? "";
  const key = `draft:${profileId}`;
  useEffect(() => {
    let active = true;
    const fresh = () => ({ id: crypto.randomUUID(), jobId: initialJobId, otherCustomer: !initialJobId, customerName: "", note: "", files: [], locked: false });
    readFieldNoteDraft(key).then(saved => { if (active) setDraft(saved ?? fresh()); }).catch(() => { if (active) { setDraft(fresh()); setStorageWarning(true); } });
    return () => { active = false; };
  }, [key, initialJobId]);
  useEffect(() => {
    if (!draft) return;
    void saveFieldNoteDraft(key, draft).catch(() => setStorageWarning(true));
  }, [draft, key]);
  useEffect(() => {
    const urls = (draft?.files ?? []).map(file => URL.createObjectURL(file));
    Promise.resolve().then(() => setPreviews(urls));
    return () => urls.forEach(url => URL.revokeObjectURL(url));
  }, [draft?.files]);
  function patch(value: Partial<FieldNoteDraft>) { setDraft(d => d ? { ...d, ...value } : d); }
  async function addFiles(files: FileList | null) {
    if (!files || !draft || busyRef.current || draft.locked) return;
    if (files.length + draft.files.length > 10) { setError("You can send up to 10 pages at a time."); return; }
    busyRef.current = true; setBusy(true); setError(null);
    try { const prepared: File[] = []; for (const file of Array.from(files)) { setProgress(`Preparing photo ${prepared.length + 1} of ${files.length}…`); prepared.push(await prepareNotePhoto(file)); } patch({ files: [...draft.files, ...prepared] }); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not open that photo."); }
    finally { busyRef.current = false; setBusy(false); setProgress(""); }
  }
  async function submit() {
    if (!draft || busyRef.current) return;
    const job = jobs.find(j => j.id === draft.jobId);
    if (!draft.otherCustomer && !job) { setError("Choose your job, or select Different customer."); return; }
    if (draft.otherCustomer && !draft.customerName.trim()) { setError("Enter the customer name."); return; }
    if (!draft.files.length && !draft.note.trim()) { setError("Type your notes or add at least one photo."); return; }
    if (!navigator.onLine) { setError("You are offline. Your draft stays here; reconnect and press Send to Office."); return; }
    busyRef.current = true; setBusy(true); setError(null); setConfirmation("");
    const frozen = { ...draft, locked: true }; patch({ locked: true });
    try {
      await saveFieldNoteDraft(key, frozen).catch(() => setStorageWarning(true));
      setProgress("Starting submission…");
      const descriptors = await Promise.all(draft.files.map(async file => ({ name: file.name, size: file.size, sha256: Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", await file.arrayBuffer()))).map(n => n.toString(16).padStart(2,"0")).join("") })));
      const matches = customers.filter(c => c.name.trim().toLowerCase() === draft.customerName.trim().toLowerCase());
      const prepared = await prepareFieldNoteSubmissionAction({ id: draft.id, customerId: draft.otherCustomer ? (matches.length === 1 ? matches[0].id : null) : job!.customerId, customerNameFreeform: draft.otherCustomer ? draft.customerName.trim() : null, jobId: draft.otherCustomer ? null : job!.id, equipmentId: draft.equipmentId || null, technicianNote: draft.note }, descriptors);
      if (!prepared.ok) throw new Error(prepared.error);
      if (!prepared.data.sent) {
        for (let i = 0; i < draft.files.length; i++) {
          setProgress(`Sending photo ${i+1} of ${draft.files.length}…`);
          const image = prepared.data.images.find(row => row.page_number === i+1);
          if (!image) throw new Error("The photo list could not be verified. Please retry.");
          const response = await fetch(`/api/field-notes/${draft.id}/images/${image.id}`, { method: "POST", headers: { "Content-Type": "image/jpeg" }, body: draft.files[i], signal: AbortSignal.timeout(90000) });
          if (!response.ok || response.redirected) { const result = await response.json().catch(() => null); throw new Error(result?.error || "Photo upload failed. Check your connection and sign-in, then retry."); }
        }
        setProgress("Confirming delivery…");
        const finished = await finishFieldNoteSubmissionAction(draft.id);
        if (!finished.ok) throw new Error(finished.error);
      }
      const customerLabel = draft.otherCustomer ? draft.customerName : job!.customerName;
      setConfirmation(`Notes sent to office. ${customerLabel} · ${draft.files.length} photos · ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}. Processing and review status appears below.`);
      await saveFieldNoteDraft(key, null).catch(() => setStorageWarning(true));
      setDraft({ id: crypto.randomUUID(), jobId: initialJobId, otherCustomer: !initialJobId, customerName: "", note: "", files: [], locked: false });
      onSubmitted?.({ customerLabel, photoCount: draft.files.length }); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Sending failed. Your photos are still here; retry when connected."); }
    finally { busyRef.current = false; setBusy(false); setProgress(""); }
  }
  if (!draft) return <p role="status">Opening your saved draft…</p>;
  return <div className="space-y-5">
    <div><h1 className="text-2xl font-semibold">{theme.heading}</h1><p className="mt-1 text-sm text-zinc-300">{theme.subheading}</p><p className="mt-2 text-sm">Technician: {technicianName}</p></div>
    {confirmation ? <p role="status" className="rounded-xl bg-emerald-900/40 p-3">{confirmation}</p> : null}
    {error ? <p role="alert" className="rounded-xl bg-red-950 p-3 text-red-100">{error}</p> : null}
    {storageWarning ? <p role="alert" className="text-sm text-amber-200">This browser cannot save a local draft. Keep this page open until delivery is confirmed.</p> : null}
    <fieldset disabled={busy || draft.locked} className="space-y-4 disabled:opacity-70">
      {!draft.otherCustomer ? <label className="block space-y-2"><span>Customer / Job</span><select className={inputClass} value={draft.jobId} onChange={e => patch({ jobId: e.target.value, equipmentId: "" })}><option value="">Choose a job</option>{jobs.map(j => <option key={j.id} value={j.id}>{j.customerName}{j.location ? ` — ${j.location}` : ""}</option>)}</select></label> : <label className="block space-y-2"><span>Customer name</span><input className={inputClass} list="field-customers" value={draft.customerName} maxLength={200} onChange={e => patch({ customerName: e.target.value, equipmentId: "" })} /><datalist id="field-customers">{customers.map(c => <option key={c.id} value={c.name} />)}</datalist></label>}
      <button type="button" onClick={() => patch({ otherCustomer: !draft.otherCustomer, equipmentId: "" })} className="min-h-11 text-cyan-200 underline">{draft.otherCustomer ? "Choose from my assigned jobs" : "Different customer / no job yet"}</button>
      <label className="block space-y-2"><span>Equipment (optional)</span><select className={inputClass} value={draft.equipmentId ?? ""} onChange={e => patch({ equipmentId: e.target.value })}><option value="">Not selected / identify in notes</option>{equipment.filter(e => e.customerId === (draft.otherCustomer ? customers.find(c => c.name.trim().toLowerCase() === draft.customerName.trim().toLowerCase())?.id : jobs.find(j => j.id === draft.jobId)?.customerId)).map(e => <option key={e.id} value={e.id}>{e.label}</option>)}</select></label>
      <div className="grid grid-cols-3 gap-2">{previews.map((url,i) => <div key={url} className="relative"><Image width={300} height={400} unoptimized src={url} alt={`Note page ${i+1}`} className="aspect-[3/4] w-full rounded-lg object-cover" /><button aria-label={`Remove page ${i+1}`} type="button" className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center rounded-full bg-black/80" onClick={() => patch({ files: draft.files.filter((_,index) => index !== i) })}><X /></button></div>)}</div>
      <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => { void addFiles(e.target.files); e.target.value = ""; }} />
      <input ref={upload} type="file" accept="image/*" multiple className="hidden" onChange={e => { void addFiles(e.target.files); e.target.value = ""; }} />
      <div className="grid grid-cols-2 gap-3"><button type="button" className="flex min-h-14 items-center justify-center gap-2 rounded-xl border border-cyan-700" onClick={() => camera.current?.click()}><Camera />Take photo</button><button type="button" className="flex min-h-14 items-center justify-center gap-2 rounded-xl border border-cyan-700" onClick={() => upload.current?.click()}><Upload />Upload photos</button></div>
      <p className="text-xs text-zinc-400">Keep your original photos on your phone. Check that the writing is clear before sending.</p>
      <label className="block space-y-2"><span>Service notes</span><textarea className={inputClass} placeholder="Findings, work performed, equipment details, and recommendations. Photos are optional when you type notes." rows={6} maxLength={10000} value={draft.note} onChange={e => patch({ note: e.target.value })} /></label>
    </fieldset>
    {draft.locked && !busy ? <p className="text-sm text-amber-200">This draft is ready to retry. Press Send to Office again to finish the same submission.</p> : null}
    <button type="button" disabled={busy} onClick={() => void submit()} className="min-h-14 w-full rounded-xl bg-blue-600 px-4 py-4 font-semibold disabled:opacity-60">{busy ? progress || "Sending…" : theme.sendLabel}</button>
  </div>;
}
