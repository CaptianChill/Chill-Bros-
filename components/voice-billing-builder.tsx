"use client";

import { Loader2, Mail, MessageSquareText, Mic, Plus, Save, Square, Trash2, Wand2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import type { PriceSource, VoiceDraft, VoiceLine } from "@/lib/chillbros/voice-billing";

type CustomerOption = { id: string; name: string; phone: string | null; email: string | null; address: string | null };
type Props = { initialType: "quote" | "invoice"; customers: CustomerOption[]; action: (formData: FormData) => Promise<void> };

const input = "min-h-11 w-full rounded-xl border border-[#2d7dff]/25 bg-black px-3 py-2 text-white placeholder:text-zinc-600";
const label = "text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400";
const usd = (n: number) => Number(n || 0).toLocaleString("en-US", { style: "currency", currency: "USD" });
const SOURCE: Record<PriceSource, { text: string; cls: string }> = {
  spoken: { text: "You said", cls: "border-zinc-500/40 text-zinc-200" },
  customer_history: { text: "Their usual price", cls: "border-emerald-400/40 text-emerald-200" },
  your_history: { text: "Your usual price", cls: "border-[#8ffafa]/40 text-[#d9fbff]" },
  catalog: { text: "Price book", cls: "border-[#2d7dff]/40 text-[#9cc3ff]" },
  needs_price: { text: "Needs a price", cls: "border-rose-400/50 text-rose-200" },
};

function pickMimeType() {
  if (typeof MediaRecorder === "undefined") return "";
  for (const t of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"]) if (MediaRecorder.isTypeSupported(t)) return t;
  return "";
}

export function totalsFor(d: VoiceDraft) {
  const subtotal = d.lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  const taxable = d.lines.filter((l) => l.taxable).reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  const discount = Math.max(0, Math.min(d.discount, subtotal));
  const taxableAfter = subtotal > 0 ? Math.max(0, taxable - discount * (taxable / subtotal)) : 0;
  const tax = Math.round(taxableAfter * d.taxRate) / 100;
  const total = Math.round((subtotal - discount + tax) * 100) / 100;
  const down = d.downPaymentType === "percent" ? Math.round(total * d.downPaymentValue) / 100 : d.downPaymentType === "dollar" ? Math.min(d.downPaymentValue, total) : 0;
  return { subtotal, discount, tax, total, down };
}

function SubmitButtons({ draft, blocked }: { draft: VoiceDraft; blocked: string }) {
  const { pending } = useFormStatus();
  const noun = draft.documentType === "quote" ? "quote" : "invoice";
  const base = "inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40";
  return <div className="space-y-2">
    {blocked ? <p role="alert" className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-sm text-amber-100">{blocked}</p> : null}
    <div className="grid gap-2 sm:grid-cols-3">
      <button type="submit" name="autoSend" value="email" disabled={pending || Boolean(blocked) || !draft.customer.email} className={`${base} bg-[#2d7dff] text-white`}>{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}Create &amp; email {noun}</button>
      <button type="submit" name="autoSend" value="sms" disabled={pending || Boolean(blocked) || !draft.customer.phone} className={`${base} border border-[#8ffafa]/40 text-[#d9fbff]`}><MessageSquareText className="h-4 w-4" />Create &amp; text {noun}</button>
      <button type="submit" name="autoSend" value="none" disabled={pending || Boolean(blocked)} className={`${base} border border-[#2d7dff]/25 text-zinc-200`}><Save className="h-4 w-4" />Create only</button>
    </div>
    {!draft.customer.email && !draft.customer.phone ? <p className="text-xs text-zinc-500">No email or phone on file — add one above to send it, or Create only and send later.</p> : null}
  </div>;
}

export function VoiceBillingBuilder({ initialType, customers, action }: Props) {
  const [docType, setDocType] = useState<"quote" | "invoice">(initialType);
  const [draft, setDraft] = useState<VoiceDraft | null>(null);
  const [transcripts, setTranscripts] = useState<string[]>([]);
  const [typed, setTyped] = useState("");
  const [status, setStatus] = useState<"idle" | "recording" | "working">("idle");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const pressedAtRef = useRef(0);
  const draftRef = useRef<VoiceDraft | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  useEffect(() => { draftRef.current = draft; }, [draft]);
  useEffect(() => {
    if (status !== "recording") return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [status]);

  async function send(payload: { audio?: Blob; text?: string }) {
    setStatus("working"); setError("");
    const fd = new FormData();
    fd.append("documentType", draftRef.current?.documentType ?? docType);
    if (payload.audio) fd.append("audio", payload.audio, payload.audio.type.includes("mp4") ? "billing.m4a" : "billing.webm");
    if (payload.text) fd.append("text", payload.text);
    if (draftRef.current) fd.append("previous", JSON.stringify(draftRef.current));
    try {
      const res = await fetch("/api/voice/billing-draft", { method: "POST", body: fd });
      const body = await res.json().catch(() => ({}));
      if (body.transcript) setTranscripts((t) => [...t, String(body.transcript)]);
      if (!res.ok || !body.draft) throw new Error(body.error || "Couldn't build the draft. Try again.");
      setDraft(body.draft as VoiceDraft); setDocType((body.draft as VoiceDraft).documentType); setTyped("");
      setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong."); }
    finally { setStatus("idle"); }
  }

  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") { setError("This browser can't record audio. Type it in the box instead."); return; }
    let stream: MediaStream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch { setError("Microphone is blocked. Allow the mic for this site, or type it in the box."); return; }
    const mimeType = pickMimeType();
    const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    chunksRef.current = [];
    rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunksRef.current, { type: rec.mimeType || mimeType || "audio/webm" });
      if (blob.size < 1500) { setStatus("idle"); setError("Didn't hear anything. Tap the mic, talk, then tap again to finish."); return; }
      void send({ audio: blob });
    };
    recorderRef.current = rec; rec.start(1000); setSeconds(0); setError(""); setStatus("recording");
  }
  function stopRecording() { const r = recorderRef.current; if (r && r.state !== "inactive") r.stop(); }

  // Tap = start, tap again = stop. Holding it down and letting go also works.
  const startedByPressRef = useRef(false);
  function onMicDown() {
    if (status === "working") return;
    pressedAtRef.current = Date.now();
    if (recorderRef.current?.state === "recording") { startedByPressRef.current = false; stopRecording(); return; }
    startedByPressRef.current = true; void startRecording();
  }
  function onMicUp() {
    if (startedByPressRef.current && Date.now() - pressedAtRef.current > 700 && recorderRef.current?.state === "recording") stopRecording();
    startedByPressRef.current = false;
  }

  const update = (patch: Partial<VoiceDraft>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const updateLine = (i: number, patch: Partial<VoiceLine>) => setDraft((d) => (d ? { ...d, lines: d.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) } : d));
  const updateCustomer = (patch: Partial<VoiceDraft["customer"]>) => setDraft((d) => (d ? { ...d, customer: { ...d.customer, ...patch } } : d));
  function chooseCustomer(id: string) {
    const c = customers.find((x) => x.id === id);
    updateCustomer(c ? { id: c.id, name: c.name, phone: c.phone ?? "", email: c.email ?? "", address: c.address ?? "" } : { id: null });
  }

  const totals = draft ? totalsFor(draft) : null;
  const blocked = !draft ? "" : !draft.customer.id && !draft.customer.name.trim() ? "Pick or name the customer first." : !draft.lines.length ? "Add at least one part, labor, or charge." : draft.lines.some((l) => !l.label.trim() || l.quantity <= 0) ? "Every line needs a name and a quantity." : draft.lines.some((l) => l.priceSource === "needs_price" && l.unitPrice <= 0) ? "Enter a price on the lines marked “Needs a price”." : (totals?.subtotal ?? 0) <= 0 ? "The total is $0 — check the prices." : "";

  const recording = status === "recording";
  return <div className="mx-auto max-w-4xl space-y-4">
    <div className="grid grid-cols-2 gap-2">
      {(["quote", "invoice"] as const).map((t) => <button key={t} type="button" onClick={() => { setDocType(t); update({ documentType: t }); }} className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${(draft?.documentType ?? docType) === t ? "border-[#8ffafa]/60 bg-[#2d7dff]/20 text-white" : "border-[#2d7dff]/25 text-[#d9fbff]"}`}>{t === "quote" ? "Quote" : "Invoice"}</button>)}
    </div>

    <section className="rounded-3xl border border-[#8ffafa]/30 bg-gradient-to-b from-[#2d7dff]/15 to-black/40 p-5 text-center">
      <button type="button" aria-label={recording ? "Stop recording" : "Start talking"} onPointerDown={onMicDown} onPointerUp={onMicUp}
        disabled={status === "working"}
        onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); if (recording) stopRecording(); else void startRecording(); } }}
        className={`mx-auto flex h-28 w-28 touch-none select-none items-center justify-center rounded-full border-2 transition ${recording ? "animate-pulse border-rose-300 bg-rose-500/30" : "border-[#8ffafa]/70 bg-[#2d7dff]/30 hover:bg-[#2d7dff]/45"} disabled:opacity-60`}>
        {status === "working" ? <Loader2 className="h-12 w-12 animate-spin text-white" /> : recording ? <Square className="h-10 w-10 text-white" /> : <Mic className="h-12 w-12 text-white" />}
      </button>
      {recording ? <button type="button" onClick={stopRecording} className="mt-3 rounded-xl border border-rose-300/50 px-4 py-2 text-sm font-semibold text-rose-100">Done talking ({Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")})</button> : null}
      <p className="mt-3 text-base font-semibold text-white">{status === "working" ? "Building it…" : recording ? "Listening — tap Done when finished" : draft ? "Tap to add or change something" : `Tap the mic and say the whole ${docType}`}</p>
      {!draft && !recording ? <p className="mx-auto mt-2 max-w-xl text-sm text-zinc-400">Example: “Invoice for El Regio Tacos. Replaced a 45/5 dual run capacitor and a 40 amp contactor, part number 42-102. Two hours labor. 3 pounds of R-410A. 50% down, net 15. Email it to them.” Prices you don't say are filled in from what you've charged before.</p> : null}
      {draft && !recording ? <p className="mx-auto mt-2 max-w-xl text-sm text-zinc-400">Say things like “add a trip charge”, “change labor to 3 hours”, “remove the contactor”, “make the down payment $500”.</p> : null}
      <div className="mx-auto mt-4 flex max-w-xl gap-2">
        <input value={typed} onChange={(e) => setTyped(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && typed.trim()) { e.preventDefault(); void send({ text: typed.trim() }); } }} placeholder={draft ? "Or type a change…" : "Or type it…"} className={input} disabled={status !== "idle"} />
        <button type="button" disabled={!typed.trim() || status !== "idle"} onClick={() => void send({ text: typed.trim() })} className="inline-flex items-center gap-1 rounded-xl border border-[#8ffafa]/40 px-3 text-sm font-semibold text-[#d9fbff] disabled:opacity-40"><Wand2 className="h-4 w-4" />Go</button>
      </div>
      {error ? <p role="alert" className="mt-3 text-sm text-rose-300">{error}</p> : null}
      {transcripts.length ? <details className="mx-auto mt-3 max-w-xl text-left text-xs text-zinc-500"><summary className="cursor-pointer">What I heard</summary>{transcripts.map((t, i) => <p key={i} className="mt-1">“{t}”</p>)}</details> : null}
    </section>

    {draft && totals ? <form ref={formRef} action={action} data-no-draft className="space-y-4 scroll-mt-4">
      <input type="hidden" name="documentType" value={draft.documentType} />
      <input type="hidden" name="paymentStatus" value="unpaid" />
      {draft.warnings.length ? <ul className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-3 text-sm text-amber-100">{draft.warnings.map((w, i) => <li key={i}>• {w}</li>)}</ul> : null}

      <section className="rounded-3xl border border-[#2d7dff]/25 bg-black/45 p-4">
        <h2 className="text-lg font-semibold text-white">Customer</h2>
        <label className={`${label} mt-3 block`}>Existing customer<select value={draft.customer.id ?? ""} onChange={(e) => chooseCustomer(e.target.value)} className={`${input} mt-1`}><option value="">New customer</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        {draft.customer.id ? <><input type="hidden" name="customerId" value={draft.customer.id} /><p className="mt-2 text-sm text-zinc-300">{[draft.customer.phone, draft.customer.email, draft.customer.address].filter(Boolean).join(" · ") || "No phone or email on file."}</p></>
          : <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className={label}>Name<input name="customerName" value={draft.customer.name} onChange={(e) => updateCustomer({ name: e.target.value })} className={`${input} mt-1`} /></label>
            <label className={label}>Phone<input name="customerPhone" inputMode="tel" value={draft.customer.phone} onChange={(e) => updateCustomer({ phone: e.target.value })} className={`${input} mt-1`} /></label>
            <label className={label}>Email<input name="customerEmail" type="email" value={draft.customer.email} onChange={(e) => updateCustomer({ email: e.target.value })} className={`${input} mt-1`} /></label>
            <label className={label}>Address<input name="customerAddress" value={draft.customer.address} onChange={(e) => updateCustomer({ address: e.target.value })} className={`${input} mt-1`} /></label>
          </div>}
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className={label}>Description<input name="jobDescription" value={draft.jobDescription} onChange={(e) => update({ jobDescription: e.target.value })} placeholder="Work / scope" className={`${input} mt-1`} /></label>
          <label className={label}>Service location<input name="jobLocation" value={draft.jobLocation} onChange={(e) => update({ jobLocation: e.target.value })} placeholder="Optional" className={`${input} mt-1`} /></label>
        </div>
        <input type="hidden" name="workPerformed" value={draft.workPerformed} />
        {draft.equipment ? <><input type="hidden" name="equipmentType" value={draft.equipment.type} /><input type="hidden" name="equipmentManufacturer" value={draft.equipment.manufacturer} /><input type="hidden" name="equipmentModel" value={draft.equipment.model} /><input type="hidden" name="equipmentSerial" value={draft.equipment.serial} /><input type="hidden" name="equipmentRefrigerant" value={draft.equipment.refrigerant} />
          <p className="mt-3 text-sm text-zinc-400">Equipment: {[draft.equipment.manufacturer, draft.equipment.model, draft.equipment.type].filter(Boolean).join(" ")}{draft.equipment.serial ? ` · S/N ${draft.equipment.serial}` : ""} <button type="button" onClick={() => update({ equipment: null })} className="ml-2 text-xs text-rose-300 underline">don&apos;t save</button></p></> : null}
      </section>

      <section className="rounded-3xl border border-[#2d7dff]/25 bg-black/45 p-4">
        <h2 className="text-lg font-semibold text-white">Parts, labor &amp; charges</h2>
        <div className="mt-3 space-y-3">{draft.lines.map((l, i) => <div key={i} className="rounded-2xl border border-[#2d7dff]/15 bg-zinc-950/70 p-3">
          <input type="hidden" name={`itemPreset${i}`} value={l.preset} /><input type="hidden" name={`itemPriceOverride${i}`} value="1" />
          <div className="flex items-center justify-between gap-2"><span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${SOURCE[l.priceSource].cls}`} title={l.priceNote}>{SOURCE[l.priceSource].text}</span><button type="button" onClick={() => update({ lines: draft.lines.filter((_, j) => j !== i) })} aria-label="Remove line" className="rounded-lg border border-rose-400/25 p-1.5 text-rose-200"><Trash2 className="h-3.5 w-3.5" /></button></div>
          <div className="mt-2 grid gap-2 sm:grid-cols-[1.6fr_80px_120px]">
            <input name={`itemLabel${i}`} value={l.label} onChange={(e) => updateLine(i, { label: e.target.value })} className={input} aria-label="Item" />
            <input name={`itemQty${i}`} type="number" min="0.01" step="0.01" value={l.quantity} onChange={(e) => updateLine(i, { quantity: Number(e.target.value) })} className={input} aria-label="Quantity" />
            <input name={`itemPrice${i}`} type="number" min="0" step="0.01" value={l.unitPrice || ""} placeholder="Price" onChange={(e) => updateLine(i, { unitPrice: Number(e.target.value), priceSource: "spoken", priceNote: "You entered this price." })} className={`${input} ${l.priceSource === "needs_price" ? "border-rose-400/60" : ""}`} aria-label="Unit price" />
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
            <input name={`itemDescription${i}`} value={l.description} onChange={(e) => updateLine(i, { description: e.target.value })} placeholder="Description / part #" className={input} />
            <label className="flex min-h-11 items-center gap-2 rounded-xl border border-[#2d7dff]/20 px-3 text-sm text-zinc-300"><input name={`itemTaxable${i}`} type="checkbox" checked={l.taxable} onChange={(e) => updateLine(i, { taxable: e.target.checked })} />Taxable</label>
            <span className="flex min-h-11 items-center justify-end px-2 text-sm font-semibold text-white">{usd(l.quantity * l.unitPrice)}</span>
          </div>
          {l.priceNote && l.priceSource !== "spoken" ? <p className="mt-1 text-xs text-zinc-500">{l.priceNote}</p> : null}
        </div>)}</div>
        {draft.lines.length < 20 ? <button type="button" onClick={() => update({ lines: [...draft.lines, { label: "", description: "", partNumber: "", quantity: 1, unitPrice: 0, taxable: true, preset: "", priceSource: "needs_price", priceNote: "" }] })} className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-1 rounded-2xl border border-[#8ffafa]/35 text-sm font-semibold text-[#d9fbff]"><Plus className="h-4 w-4" />Add a line</button> : null}
      </section>

      <section className="grid gap-3 rounded-3xl border border-amber-400/25 bg-amber-500/[0.04] p-4 sm:grid-cols-2">
        <label className={label}>Down payment<select name="downPaymentType" value={draft.downPaymentType} onChange={(e) => update({ downPaymentType: e.target.value as VoiceDraft["downPaymentType"] })} className={`${input} mt-1`}><option value="">None</option><option value="percent">Percent %</option><option value="dollar">Dollar $</option></select></label>
        <label className={label}>Down payment amount<input name="downPaymentValue" type="number" min="0" step="0.01" value={draft.downPaymentValue} onChange={(e) => update({ downPaymentValue: Number(e.target.value) })} disabled={!draft.downPaymentType} className={`${input} mt-1 disabled:opacity-40`} /></label>
        <label className={label}>Payment terms<select name="paymentTerms" value={draft.paymentTerms} onChange={(e) => update({ paymentTerms: e.target.value as VoiceDraft["paymentTerms"] })} className={`${input} mt-1`}><option value="due_on_receipt">Due on receipt</option><option value="net_7">Net 7</option><option value="net_15">Net 15</option><option value="net_30">Net 30</option><option value="custom">Custom date</option></select></label>
        {draft.paymentTerms === "custom" ? <label className={label}>Due date<input name="customDueDate" type="date" value={draft.customDueDate} onChange={(e) => update({ customDueDate: e.target.value })} className={`${input} mt-1`} /></label> : <input type="hidden" name="customDueDate" value="" />}
        <label className={label}>Discount $<input name="discount" type="number" min="0" step="0.01" value={draft.discount} onChange={(e) => update({ discount: Number(e.target.value) })} className={`${input} mt-1`} /></label>
        <label className={label}>Sales tax %<input name="taxRate" type="number" min="0" max="25" step="0.001" value={draft.taxRate} onChange={(e) => update({ taxRate: Number(e.target.value) })} className={`${input} mt-1`} /></label>
        <label className={`${label} sm:col-span-2`}>Customer notes<textarea name="notes" rows={2} value={draft.notes} onChange={(e) => update({ notes: e.target.value })} placeholder="Warranty, terms, thank-you note" className={`${input} mt-1 resize-y`} /></label>
      </section>

      <section className="rounded-3xl border border-[#8ffafa]/30 bg-zinc-950/80 p-4 text-sm">
        <div className="flex justify-between text-zinc-300"><span>Subtotal</span><span>{usd(totals.subtotal)}</span></div>
        {totals.discount ? <div className="flex justify-between text-zinc-300"><span>Discount</span><span>−{usd(totals.discount)}</span></div> : null}
        <div className="flex justify-between text-zinc-300"><span>Sales tax ({draft.taxRate}%)</span><span>{usd(totals.tax)}</span></div>
        <div className="mt-2 flex justify-between text-xl font-semibold text-white"><span>Total</span><span>{usd(totals.total)}</span></div>
        {totals.down ? <div className="mt-1 flex justify-between font-semibold text-amber-200"><span>Due upfront</span><span>{usd(totals.down)}</span></div> : null}
      </section>

      <SubmitButtons draft={draft} blocked={blocked} />
    </form> : null}
  </div>;
}
