"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { BadgeCheck, Check, ChevronDown, Copy, FileText, Mail, MessageSquare, Plus, Save, Send, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";

import {
  createServiceAgreementAction,
  recordVerbalAgreementApprovalAction,
  setServiceAgreementStatusAction,
  updateServiceAgreementAction,
  type ServiceAgreementInput,
} from "@/lib/chillbros/service-agreement-actions";
import type { ServiceAgreement, ServiceAgreementStatus } from "@/lib/chillbros/service-agreement-queries";
import { calculatePlanPricing, DEFAULT_PLAN_TERMS, PLAN_STARTERS } from "@/lib/chillbros/service-plan-pricing";
import type { Customer } from "@/lib/chillbros/types";
import { StatusPill } from "@/components/status-pill";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const money = (value: number) => value.toLocaleString("en-US", { style: "currency", currency: "USD" });
const DEFAULT_RATE = "95";
const input = "w-full rounded-xl border border-[#2d7dff]/20 bg-zinc-950 px-3 py-2.5 text-white";
const smallBtn = "inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#2d7dff]/30 px-3 py-2 text-xs text-[#d9fbff] disabled:opacity-50";

type FormState = {
  customerId: string;
  starter: string;
  title: string;
  calculationMode: "hourly" | "flat";
  visitsPerMonth: string;
  hoursPerVisit: string;
  hourlyRate: string;
  monthlyFlatRate: string;
  preferredDays: string[];
  preferredTimeWindow: string;
  startDate: string;
  endDate: string;
  servicesIncluded: string;
  customerPreferences: string;
  terms: string;
  setupFee: string;
  discountType: "none" | "percent" | "dollar";
  discountValue: string;
};

function blank(customerId = "", starterId = "standard"): FormState {
  const starter = PLAN_STARTERS.find((s) => s.id === starterId);
  return {
    customerId,
    starter: starter?.id ?? "custom",
    title: starter?.title ?? "Custom Monthly Service Plan",
    calculationMode: "hourly",
    visitsPerMonth: String(starter?.visitsPerMonth ?? 1),
    hoursPerVisit: String(starter?.hoursPerVisit ?? 2),
    hourlyRate: DEFAULT_RATE,
    monthlyFlatRate: "",
    preferredDays: [],
    preferredTimeWindow: "",
    startDate: "",
    endDate: "",
    servicesIncluded: starter?.servicesIncluded ?? "",
    customerPreferences: "",
    terms: DEFAULT_PLAN_TERMS,
    setupFee: "0",
    discountType: "none",
    discountValue: "0",
  };
}

function fromAgreement(a: ServiceAgreement): FormState {
  return {
    customerId: a.customerId,
    starter: "",
    title: a.title,
    calculationMode: a.calculationMode,
    visitsPerMonth: String(a.visitsPerMonth),
    hoursPerVisit: String(a.hoursPerVisit),
    hourlyRate: String(a.hourlyRate),
    monthlyFlatRate: String(a.monthlyFlatRate),
    preferredDays: a.preferredDays,
    preferredTimeWindow: a.preferredTimeWindow ?? "",
    startDate: a.startDate ?? "",
    endDate: a.endDate ?? "",
    servicesIncluded: a.servicesIncluded ?? "",
    customerPreferences: a.customerPreferences ?? "",
    terms: a.terms ?? DEFAULT_PLAN_TERMS,
    setupFee: String(a.setupFee),
    discountType: a.discountType ?? "none",
    discountValue: String(a.discountValue),
  };
}

function toInput(state: FormState): ServiceAgreementInput {
  return {
    customerId: state.customerId,
    title: state.title,
    calculationMode: state.calculationMode,
    visitsPerMonth: Number(state.visitsPerMonth),
    hoursPerVisit: Number(state.hoursPerVisit),
    hourlyRate: Number(state.hourlyRate),
    monthlyFlatRate: Number(state.monthlyFlatRate),
    preferredDays: state.preferredDays,
    preferredTimeWindow: state.preferredTimeWindow,
    startDate: state.startDate,
    endDate: state.endDate,
    servicesIncluded: state.servicesIncluded,
    customerPreferences: state.customerPreferences,
    terms: state.terms,
    setupFee: Number(state.setupFee) || 0,
    discountType: state.discountType === "none" ? null : state.discountType,
    discountValue: Number(state.discountValue) || 0,
  };
}

const statusTone = (status: ServiceAgreementStatus) => (status === "active" || status === "accepted" ? "emerald" : status === "cancelled" ? "rose" : "amber");
const statusLabel: Record<ServiceAgreementStatus, string> = { draft: "Draft", proposed: "Waiting on customer", accepted: "Approved — activate", active: "Active", cancelled: "Cancelled" };

function planUrl(token: string) {
  const configured = String(process.env.NEXT_PUBLIC_APP_URL || "").trim().replace(/\/$/, "");
  return `${configured || "https://chill-bros.vercel.app"}/agreement/${token}`;
}

type Saved = { agreementNumber: string; portalToken: string; id: string; title: string; total: number; customerId: string };
type Filter = "open" | "active" | "all";

export function ServiceAgreementAdmin({ customers, agreements, initialCustomerId, focusPlanId }: { customers: Customer[]; agreements: ServiceAgreement[]; initialCustomerId?: string; focusPlanId?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const startingCustomer = initialCustomerId && customers.some((c) => c.id === initialCustomerId) ? initialCustomerId : "";
  const [form, setForm] = useState<FormState>(blank(startingCustomer));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<Saved | null>(null);
  const [filter, setFilter] = useState<Filter>(focusPlanId ? "all" : "open");
  const customerById = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers]);
  const t = calculatePlanPricing(toInput(form));

  const counts = {
    open: agreements.filter((a) => ["draft", "proposed", "accepted"].includes(a.status)).length,
    active: agreements.filter((a) => a.status === "active").length,
    all: agreements.length,
  };
  const visible = agreements
    .filter((a) => (filter === "open" ? ["draft", "proposed", "accepted"].includes(a.status) : filter === "active" ? a.status === "active" : true))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const create = () => {
    setError(null);
    startTransition(async () => {
      const result = await createServiceAgreementAction(toInput(form));
      if (!result.ok) { setError(result.error); return; }
      setSaved({ ...result.data, title: form.title, total: t.monthlyTotal, customerId: form.customerId });
      setForm(blank(form.customerId));
      router.refresh();
    });
  };

  return <div className="space-y-6">
    {saved ? <div className="space-y-3 rounded-2xl border border-emerald-500/35 bg-emerald-500/10 p-4">
      <div className="flex items-start gap-3"><Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" /><div><p className="font-medium text-emerald-100">{saved.agreementNumber} saved — {money(saved.total)}/month</p><p className="text-sm text-emerald-200/80">{saved.title} for {customerById.get(saved.customerId)?.name ?? "customer"}. Send it now:</p></div></div>
      <ShareActions token={saved.portalToken} title={saved.title} email={customerById.get(saved.customerId)?.email ?? null} phone={customerById.get(saved.customerId)?.phone ?? null} />
      <button type="button" onClick={() => setSaved(null)} className="text-xs text-emerald-200/70 underline">Build another plan</button>
    </div> : null}

    {!saved ? <div className="space-y-5 rounded-2xl border border-[#2d7dff]/25 bg-black/40 p-4">
      <Step n={1} label="Customer">
        <select value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })} className={input} aria-label="Customer">
          <option value="">Choose customer</option>
          {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Step>

      <Step n={2} label="Start from a package">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {PLAN_STARTERS.map((s) => <button key={s.id} type="button" onClick={() => setForm({ ...blank(form.customerId, s.id), hourlyRate: form.hourlyRate, calculationMode: form.calculationMode, monthlyFlatRate: form.monthlyFlatRate })} className={`rounded-xl border px-3 py-2.5 text-left ${form.starter === s.id ? "border-[#8ffafa]/60 bg-[#2d7dff]/15" : "border-[#2d7dff]/20"}`}><p className="text-sm font-medium text-white">{s.label}</p><p className="text-xs text-zinc-400">{s.blurb}</p></button>)}
          <button type="button" onClick={() => setForm({ ...blank(form.customerId, "custom"), hourlyRate: form.hourlyRate })} className={`rounded-xl border px-3 py-2.5 text-left ${form.starter === "custom" ? "border-[#8ffafa]/60 bg-[#2d7dff]/15" : "border-[#2d7dff]/20"}`}><p className="text-sm font-medium text-white">Custom</p><p className="text-xs text-zinc-400">Blank plan</p></button>
        </div>
      </Step>

      <Step n={3} label="Price & scope">
        <PlanCore state={form} setState={setForm} />
      </Step>

      <MoreOptions state={form} setState={setForm} />

      {error ? <p className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</p> : null}
      <div className="sticky bottom-20 z-10 flex items-center gap-3 rounded-2xl border border-[#2d7dff]/40 bg-zinc-950/95 p-3 backdrop-blur sm:bottom-4">
        <div className="min-w-0 flex-1"><p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">Monthly total</p><p className="text-lg font-semibold text-[#bafcfc]">{money(t.monthlyTotal)}{Number(form.setupFee) > 0 ? <span className="ml-2 text-xs font-normal text-zinc-400">+ {money(Number(form.setupFee))} setup</span> : null}</p></div>
        <button type="button" onClick={create} disabled={pending || !form.customerId} className="inline-flex items-center gap-2 rounded-xl border border-[#2d7dff] bg-[#2d7dff]/20 px-4 py-3 text-sm font-medium text-[#d9fbff] disabled:opacity-50"><Plus className="h-4 w-4" />{pending ? "Saving…" : "Save & get link"}</button>
      </div>
    </div> : null}

    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {([["open", "Open"], ["active", "Active"], ["all", "All"]] as const).map(([key, label]) => <button key={key} type="button" onClick={() => setFilter(key)} className={`rounded-full border px-3 py-1.5 text-xs ${filter === key ? "border-[#8ffafa]/50 bg-[#2d7dff]/15 text-[#d9fbff]" : "border-[#2d7dff]/20 text-zinc-400"}`}>{label} ({counts[key]})</button>)}
      </div>
      {visible.length === 0 ? <p className="text-sm text-zinc-500">{filter === "open" ? "No plans waiting on approval." : filter === "active" ? "No active plans yet." : "No monthly plans created yet."}</p> : <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">{visible.map((agreement) => <AgreementEditor key={agreement.id} agreement={agreement} customers={customers} defaultOpen={agreement.id === focusPlanId} />)}</div>}
    </div>
  </div>;
}

function Step({ n, label, children }: { n: number; label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><p className="text-xs uppercase tracking-[0.16em] text-zinc-400"><span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full border border-[#2d7dff]/40 text-[10px] text-[#bafcfc]">{n}</span>{label}</p>{children}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-1"><span className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">{label}</span>{children}</label>;
}

function PlanCore({ state, setState }: { state: FormState; setState: (next: FormState) => void }) {
  const set = (patch: Partial<FormState>) => setState({ ...state, ...patch });
  return <div className="space-y-3">
    <div className="inline-flex rounded-xl border border-[#2d7dff]/25 p-1 text-xs">
      {([["hourly", "By the hour"], ["flat", "Flat monthly"]] as const).map(([mode, label]) => <button key={mode} type="button" onClick={() => set({ calculationMode: mode })} className={`rounded-lg px-3 py-1.5 ${state.calculationMode === mode ? "bg-[#2d7dff]/25 text-white" : "text-zinc-400"}`}>{label}</button>)}
    </div>
    <div className="grid grid-cols-3 gap-2">
      <Field label="Visits / month"><input type="number" inputMode="numeric" min="1" max="31" value={state.visitsPerMonth} onChange={(e) => set({ visitsPerMonth: e.target.value })} className={input} /></Field>
      <Field label="Hours / visit"><input type="number" inputMode="decimal" min="0" step="0.25" value={state.hoursPerVisit} onChange={(e) => set({ hoursPerVisit: e.target.value })} className={input} /></Field>
      {state.calculationMode === "hourly"
        ? <Field label="Rate / hour"><input type="number" inputMode="decimal" min="0" step="0.01" value={state.hourlyRate} onChange={(e) => set({ hourlyRate: e.target.value })} className={input} /></Field>
        : <Field label="Price / month"><input type="number" inputMode="decimal" min="0" step="0.01" value={state.monthlyFlatRate} onChange={(e) => set({ monthlyFlatRate: e.target.value })} placeholder="0.00" className={input} /></Field>}
    </div>
    <Field label="Services included (one per line)"><textarea value={state.servicesIncluded} onChange={(e) => set({ servicesIncluded: e.target.value })} rows={5} placeholder="PM checks, filters, coil cleaning, refrigeration inspection…" className={input} /></Field>
  </div>;
}

function MoreOptions({ state, setState }: { state: FormState; setState: (next: FormState) => void }) {
  const set = (patch: Partial<FormState>) => setState({ ...state, ...patch });
  const toggleDay = (day: string) => set({ preferredDays: state.preferredDays.includes(day) ? state.preferredDays.filter((d) => d !== day) : [...state.preferredDays, day] });
  const t = calculatePlanPricing(toInput(state));
  return <details className="group rounded-xl border border-[#2d7dff]/15 p-3">
    <summary className="flex cursor-pointer list-none items-center justify-between text-sm text-zinc-300">More options <span className="text-xs text-zinc-500">title, schedule, dates, discount, setup fee, terms</span><ChevronDown className="h-4 w-4 transition group-open:rotate-180" /></summary>
    <div className="mt-3 space-y-3">
      <Field label="Plan title"><input value={state.title} onChange={(e) => set({ title: e.target.value })} className={input} /></Field>
      <div><p className="mb-1 text-[11px] uppercase tracking-[0.12em] text-zinc-500">Preferred days</p><div className="flex flex-wrap gap-2">{DAYS.map((day) => <button type="button" key={day} onClick={() => toggleDay(day)} className={`rounded-full border px-3 py-1.5 text-xs ${state.preferredDays.includes(day) ? "border-[#8ffafa]/50 bg-[#2d7dff]/15 text-[#d9fbff]" : "border-[#2d7dff]/20 text-zinc-400"}`}>{day.slice(0, 3)}</button>)}</div></div>
      <div className="grid gap-2 sm:grid-cols-3">
        <Field label="Preferred time"><input value={state.preferredTimeWindow} onChange={(e) => set({ preferredTimeWindow: e.target.value })} placeholder="8 AM–12 PM" className={input} /></Field>
        <Field label="Start date"><input type="date" value={state.startDate} onChange={(e) => set({ startDate: e.target.value })} className={input} /></Field>
        <Field label="End date (blank = ongoing)"><input type="date" value={state.endDate} onChange={(e) => set({ endDate: e.target.value })} className={input} /></Field>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <Field label="One-time setup fee"><input type="number" inputMode="decimal" min="0" step="0.01" value={state.setupFee} onChange={(e) => set({ setupFee: e.target.value })} className={input} /></Field>
        <Field label="Discount"><select value={state.discountType} onChange={(e) => set({ discountType: e.target.value as FormState["discountType"] })} className={input}><option value="none">None</option><option value="percent">Percent %</option><option value="dollar">Dollar $</option></select></Field>
        {state.discountType !== "none" ? <Field label={state.discountType === "percent" ? "Discount %" : "Discount $"}><input type="number" inputMode="decimal" min="0" step="0.01" value={state.discountValue} onChange={(e) => set({ discountValue: e.target.value })} className={input} /></Field> : null}
      </div>
      {t.discountAmount > 0 ? <p className="text-xs text-zinc-400">{money(t.monthlySubtotal)} − {money(t.discountAmount)} discount = <span className="text-[#bafcfc]">{money(t.monthlyTotal)}/month</span></p> : null}
      <Field label="Customer notes / access instructions"><textarea value={state.customerPreferences} onChange={(e) => set({ customerPreferences: e.target.value })} rows={2} placeholder="Gate code, priority equipment, contact on site…" className={input} /></Field>
      <Field label="Terms"><textarea value={state.terms} onChange={(e) => set({ terms: e.target.value })} rows={3} className={input} /></Field>
    </div>
  </details>;
}

function ShareActions({ token, title, email, phone }: { token: string; title: string; email: string | null; phone: string | null }) {
  const [note, setNote] = useState<string | null>(null);
  const copy = async () => { try { await navigator.clipboard.writeText(planUrl(token)); setNote("Link copied."); } catch { setNote("Couldn't copy on this device — open the quote and share from there."); } };
  const text = () => { if (phone) window.location.href = `sms:${phone.replace(/[^+\d]/g, "")}?&body=${encodeURIComponent(`Chill Pros ${title}: ${planUrl(token)}`)}`; };
  const mail = () => { window.location.href = `mailto:${encodeURIComponent(email ?? "")}?subject=${encodeURIComponent(`Chill Pros ${title}`)}&body=${encodeURIComponent(`Here is your custom Chill Pros monthly service plan. Review and accept it here: ${planUrl(token)}`)}`; };
  return <div className="space-y-2">
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
      <button type="button" onClick={copy} className={smallBtn}><Copy className="h-3.5 w-3.5" />Copy link</button>
      <button type="button" onClick={text} disabled={!phone} title={phone ? undefined : "No phone on file"} className={smallBtn}><MessageSquare className="h-3.5 w-3.5" />Text</button>
      <button type="button" onClick={mail} className={smallBtn}><Mail className="h-3.5 w-3.5" />Email</button>
      <Link href={`/agreement/${token}`} target="_blank" className={smallBtn}><Send className="h-3.5 w-3.5" />Customer view</Link>
      <Link href={`/agreement/${token}/document`} target="_blank" className={smallBtn}><FileText className="h-3.5 w-3.5" />Print / PDF</Link>
    </div>
    {note ? <p className="text-xs text-zinc-400">{note}</p> : null}
  </div>;
}

function AgreementEditor({ agreement, customers, defaultOpen }: { agreement: ServiceAgreement; customers: Customer[]; defaultOpen: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<FormState>(fromAgreement(agreement));
  const [approvedBy, setApprovedBy] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(defaultOpen);
  const t = calculatePlanPricing(toInput(state));
  const signed = ["accepted", "active"].includes(agreement.status);
  const waiting = ["draft", "proposed"].includes(agreement.status);

  useEffect(() => {
    if (defaultOpen) document.getElementById(`plan-${agreement.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [defaultOpen, agreement.id]);

  const run = (fn: () => Promise<{ ok: boolean; error?: string; data?: unknown }>, success: string) => { setError(null); setMessage(null); startTransition(async () => { const result = await fn(); if (!result.ok) { setError(result.error ?? "Action failed."); return; } const detail = result.data && typeof result.data === "object" && "message" in result.data ? (result.data as { message?: string }).message : undefined; setMessage(detail || success); router.refresh(); }); };
  const save = () => {
    if (signed && !window.confirm("This plan was already approved. Saving changes sends it back to the customer for a new approval. Continue?")) return;
    run(() => updateServiceAgreementAction({ ...toInput(state), id: agreement.id }), signed ? "Saved. Customer needs to approve the updated plan." : "Plan updated.");
  };
  const setStatus = (status: "proposed" | "active" | "cancelled") => run(() => setServiceAgreementStatusAction(agreement.id, status), status === "active" ? "Plan is active." : status === "cancelled" ? "Plan cancelled." : "Plan reopened.");
  const verbal = () => run(() => recordVerbalAgreementApprovalAction(agreement.id, approvedBy), "Verbal approval recorded.");

  return <div id={`plan-${agreement.id}`} className={`rounded-2xl border bg-zinc-950/70 ${open ? "col-span-full border-[#8ffafa]/40" : "border-[#2d7dff]/20"}`}>
    <button type="button" onClick={() => setOpen(!open)} className="flex w-full flex-col gap-2 p-3 text-left">
      <StatusPill tone={statusTone(agreement.status)}>{statusLabel[agreement.status]}</StatusPill>
      <p className="line-clamp-2 font-semibold leading-tight text-white">{agreement.customerName}</p>
      <p className="text-base font-semibold text-[#bafcfc]">{money(agreement.monthlyTotal)}<span className="text-xs font-normal text-zinc-500">/mo</span></p>
      <p className="truncate text-[11px] text-zinc-500">{agreement.agreementNumber}</p>
    </button>
    {open ? <div className="space-y-4 border-t border-[#2d7dff]/10 p-4">
      <ShareActions token={agreement.portalToken} title={agreement.title} email={agreement.customerEmail} phone={agreement.customerPhone} />
      {agreement.signatureName ? <p className="text-xs text-emerald-300">Approved by {agreement.signatureName}{agreement.signedAt ? ` on ${new Date(agreement.signedAt).toLocaleDateString("en-US")}` : ""}</p> : null}

      {waiting ? <div className="flex flex-col gap-2 rounded-xl border border-emerald-500/20 p-3 sm:flex-row sm:items-center">
        <input value={approvedBy} onChange={(e) => setApprovedBy(e.target.value)} placeholder="Customer approved by phone/in person — their name" className={`${input} sm:flex-1`} />
        <button type="button" onClick={verbal} disabled={pending || approvedBy.trim().length < 2} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-emerald-500/35 px-3 py-2.5 text-xs text-emerald-100 disabled:opacity-50"><BadgeCheck className="h-3.5 w-3.5" />Record verbal approval</button>
      </div> : null}

      <div className="flex flex-wrap gap-2">
        {agreement.status === "accepted" ? <button type="button" onClick={() => setStatus("active")} disabled={pending} className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">Activate plan</button> : null}
        {agreement.status === "cancelled" ? <button type="button" onClick={() => setStatus("proposed")} disabled={pending} className="rounded-xl border border-amber-500/30 px-3 py-2 text-xs text-amber-200">Reopen proposal</button> : <button type="button" onClick={() => { if (window.confirm("Cancel this plan?")) setStatus("cancelled"); }} disabled={pending} className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/25 px-3 py-2 text-xs text-rose-200"><XCircle className="h-3.5 w-3.5" />Cancel plan</button>}
      </div>

      <details className="rounded-xl border border-[#2d7dff]/15 p-3">
        <summary className="cursor-pointer text-sm text-zinc-300">Edit plan</summary>
        <div className="mt-3 space-y-3">
          <Field label="Customer"><select value={state.customerId} onChange={(e) => setState({ ...state, customerId: e.target.value })} className={input}>{customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
          <PlanCore state={state} setState={setState} />
          <MoreOptions state={state} setState={setState} />
          <div className="flex items-center justify-between gap-3"><p className="text-sm text-zinc-300">New total <span className="font-semibold text-[#bafcfc]">{money(t.monthlyTotal)}/mo</span></p><button type="button" onClick={save} disabled={pending} className={smallBtn}><Save className="h-3.5 w-3.5" />Save changes</button></div>
          {signed ? <p className="text-xs text-amber-300">Already approved — saving changes will ask the customer to approve again.</p> : null}
        </div>
      </details>
      {error ? <p className="text-xs text-rose-300">{error}</p> : null}
      {message ? <p className="text-xs text-emerald-300">{message}</p> : null}
    </div> : null}
  </div>;
}
