"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { CalendarDays, Copy, FileText, Mail, Plus, Save, Send, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";

import { createServiceAgreementAction, setServiceAgreementStatusAction, updateServiceAgreementAction, type ServiceAgreementInput } from "@/lib/chillbros/service-agreement-actions";
import type { ServiceAgreement } from "@/lib/chillbros/service-agreement-queries";
import type { Customer } from "@/lib/chillbros/types";
import { StatusPill } from "@/components/status-pill";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const money = (value: number) => value.toLocaleString("en-US", { style: "currency", currency: "USD" });
const DEFAULT_TERMS = "Monthly service is scheduled according to the days, visit frequency, hours, scope, and pricing shown in this agreement. Work outside the included scope may be quoted separately. Schedule changes should be coordinated with Chill Bros in advance.";

const blank = (customerId = ""): FormState => ({
  customerId,
  title: "Custom Monthly Service Plan",
  calculationMode: "hourly",
  visitsPerMonth: "1",
  hoursPerVisit: "2",
  hourlyRate: "95",
  monthlyFlatRate: "0",
  preferredDays: [],
  preferredTimeWindow: "",
  startDate: "",
  endDate: "",
  servicesIncluded: "",
  customerPreferences: "",
  terms: DEFAULT_TERMS,
  setupFee: "0",
  discountType: "none",
  discountValue: "0",
});

type FormState = {
  customerId: string;
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

function fromAgreement(a: ServiceAgreement): FormState {
  return {
    customerId: a.customerId,
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
    terms: a.terms ?? DEFAULT_TERMS,
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
    setupFee: Number(state.setupFee),
    discountType: state.discountType === "none" ? null : state.discountType,
    discountValue: Number(state.discountValue),
  };
}

function totals(state: FormState) {
  const visits = Math.max(1, Number(state.visitsPerMonth) || 1);
  const hours = Math.max(0, Number(state.hoursPerVisit) || 0);
  const rate = Math.max(0, Number(state.hourlyRate) || 0);
  const flat = Math.max(0, Number(state.monthlyFlatRate) || 0);
  const subtotal = state.calculationMode === "flat" ? flat : visits * hours * rate;
  const d = Math.max(0, Number(state.discountValue) || 0);
  const discount = state.discountType === "percent" ? Math.min(subtotal, subtotal * Math.min(100, d) / 100) : state.discountType === "dollar" ? Math.min(subtotal, d) : 0;
  return { subtotal, discount, total: Math.max(0, subtotal - discount), setup: Math.max(0, Number(state.setupFee) || 0) };
}

export function ServiceAgreementAdmin({ customers, agreements }: { customers: Customer[]; agreements: ServiceAgreement[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<FormState>(blank(customers[0]?.id ?? ""));
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const grouped = useMemo(() => customers.map((customer) => ({ customer, rows: agreements.filter((a) => a.customerId === customer.id) })).filter((g) => g.rows.length > 0), [customers, agreements]);

  const create = () => {
    setError(null); setMessage(null);
    startTransition(async () => {
      const result = await createServiceAgreementAction(toInput(form));
      if (!result.ok) { setError(result.error); return; }
      setMessage(`${result.data.agreementNumber} saved. Customer quote is ready.`);
      setForm(blank(form.customerId));
      router.refresh();
    });
  };

  return <div className="space-y-5">
    {error ? <p className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p> : null}
    {message ? <p className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{message}</p> : null}
    <details open className="rounded-2xl border border-[#2d7dff]/25 bg-black/40 p-4"><summary className="cursor-pointer text-lg font-medium text-white">Create custom monthly plan</summary><div className="mt-4"><AgreementFields state={form} setState={setForm} customers={customers} /><button type="button" onClick={create} disabled={pending || !form.customerId} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#2d7dff] bg-[#2d7dff]/10 px-4 py-3 text-sm font-medium text-[#d9fbff] disabled:opacity-50"><Plus className="h-4 w-4" />Save customer plan & create quote</button></div></details>

    {grouped.length === 0 ? <p className="text-sm text-zinc-500">No monthly plans created yet.</p> : <div className="space-y-3">{grouped.map(({ customer, rows }) => <details key={customer.id} className="group rounded-2xl border border-[#2d7dff]/20 bg-black/35 p-4"><summary className="flex cursor-pointer list-none items-center justify-between gap-3"><div><p className="font-medium text-white">{customer.name}</p><p className="text-xs text-zinc-500">{rows.length} plan{rows.length === 1 ? "" : "s"}</p></div><CalendarDays className="h-4 w-4 text-[#bafcfc]" /></summary><div className="mt-4 space-y-3">{rows.map((agreement) => <AgreementEditor key={agreement.id} agreement={agreement} customers={customers} />)}</div></details>)}</div>}
  </div>;
}

function AgreementFields({ state, setState, customers }: { state: FormState; setState: (next: FormState) => void; customers: Customer[] }) {
  const t = totals(state);
  const toggleDay = (day: string) => setState({ ...state, preferredDays: state.preferredDays.includes(day) ? state.preferredDays.filter((d) => d !== day) : [...state.preferredDays, day] });
  return <div className="space-y-4">
    <div className="grid gap-2 md:grid-cols-3"><select value={state.customerId} onChange={(e) => setState({ ...state, customerId: e.target.value })} className="rounded-xl border border-[#2d7dff]/20 bg-zinc-950 px-3 py-2 text-white"><option value="">Choose customer</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select><input value={state.title} onChange={(e) => setState({ ...state, title: e.target.value })} placeholder="Plan title" className="md:col-span-2 rounded-xl border border-[#2d7dff]/20 bg-zinc-950 px-3 py-2 text-white" /></div>
    <div className="grid gap-2 md:grid-cols-4"><select value={state.calculationMode} onChange={(e) => setState({ ...state, calculationMode: e.target.value as "hourly" | "flat" })} className="rounded-xl border border-[#2d7dff]/20 bg-zinc-950 px-3 py-2 text-white"><option value="hourly">Hours × visits × rate</option><option value="flat">Flat monthly rate</option></select><input type="number" min="1" max="31" value={state.visitsPerMonth} onChange={(e) => setState({ ...state, visitsPerMonth: e.target.value })} placeholder="Visits / month" className="rounded-xl border border-[#2d7dff]/20 bg-zinc-950 px-3 py-2 text-white" /><input type="number" min="0" step="0.25" value={state.hoursPerVisit} onChange={(e) => setState({ ...state, hoursPerVisit: e.target.value })} placeholder="Hours / visit" className="rounded-xl border border-[#2d7dff]/20 bg-zinc-950 px-3 py-2 text-white" />{state.calculationMode === "hourly" ? <input type="number" min="0" step="0.01" value={state.hourlyRate} onChange={(e) => setState({ ...state, hourlyRate: e.target.value })} placeholder="Hourly rate" className="rounded-xl border border-[#2d7dff]/20 bg-zinc-950 px-3 py-2 text-white" /> : <input type="number" min="0" step="0.01" value={state.monthlyFlatRate} onChange={(e) => setState({ ...state, monthlyFlatRate: e.target.value })} placeholder="Monthly flat rate" className="rounded-xl border border-[#2d7dff]/20 bg-zinc-950 px-3 py-2 text-white" />}</div>
    <div><p className="mb-2 text-xs uppercase tracking-[0.16em] text-zinc-500">Preferred service days</p><div className="flex flex-wrap gap-2">{DAYS.map((day) => <button type="button" key={day} onClick={() => toggleDay(day)} className={`rounded-full border px-3 py-1.5 text-xs ${state.preferredDays.includes(day) ? "border-[#8ffafa]/50 bg-[#2d7dff]/15 text-[#d9fbff]" : "border-[#2d7dff]/20 text-zinc-400"}`}>{day.slice(0, 3)}</button>)}</div></div>
    <div className="grid gap-2 md:grid-cols-3"><input value={state.preferredTimeWindow} onChange={(e) => setState({ ...state, preferredTimeWindow: e.target.value })} placeholder="Preferred time, e.g. 8 AM–12 PM" className="rounded-xl border border-[#2d7dff]/20 bg-zinc-950 px-3 py-2 text-white" /><input type="date" value={state.startDate} onChange={(e) => setState({ ...state, startDate: e.target.value })} className="rounded-xl border border-[#2d7dff]/20 bg-zinc-950 px-3 py-2 text-white" /><input type="date" value={state.endDate} onChange={(e) => setState({ ...state, endDate: e.target.value })} className="rounded-xl border border-[#2d7dff]/20 bg-zinc-950 px-3 py-2 text-white" /></div>
    <textarea value={state.servicesIncluded} onChange={(e) => setState({ ...state, servicesIncluded: e.target.value })} rows={3} placeholder="Services included: PM checks, filters, coil cleaning, refrigeration inspection, kitchen equipment checks..." className="w-full rounded-xl border border-[#2d7dff]/20 bg-zinc-950 px-3 py-2 text-white" />
    <textarea value={state.customerPreferences} onChange={(e) => setState({ ...state, customerPreferences: e.target.value })} rows={3} placeholder="Customer preferences, access instructions, priority equipment, special scheduling requests..." className="w-full rounded-xl border border-[#2d7dff]/20 bg-zinc-950 px-3 py-2 text-white" />
    <textarea value={state.terms} onChange={(e) => setState({ ...state, terms: e.target.value })} rows={3} placeholder="Custom agreement terms" className="w-full rounded-xl border border-[#2d7dff]/20 bg-zinc-950 px-3 py-2 text-white" />
    <div className="grid gap-2 md:grid-cols-3"><input type="number" min="0" step="0.01" value={state.setupFee} onChange={(e) => setState({ ...state, setupFee: e.target.value })} placeholder="One-time setup fee" className="rounded-xl border border-[#2d7dff]/20 bg-zinc-950 px-3 py-2 text-white" /><select value={state.discountType} onChange={(e) => setState({ ...state, discountType: e.target.value as FormState["discountType"] })} className="rounded-xl border border-[#2d7dff]/20 bg-zinc-950 px-3 py-2 text-white"><option value="none">No discount</option><option value="percent">Discount %</option><option value="dollar">Discount $</option></select><input type="number" min="0" step="0.01" value={state.discountValue} onChange={(e) => setState({ ...state, discountValue: e.target.value })} placeholder="Discount value" className="rounded-xl border border-[#2d7dff]/20 bg-zinc-950 px-3 py-2 text-white" /></div>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><TotalCard label="Monthly subtotal" value={money(t.subtotal)} /><TotalCard label="Discount" value={`−${money(t.discount)}`} /><TotalCard label="Monthly total" value={money(t.total)} emphasis /><TotalCard label="One-time setup" value={money(t.setup)} /></div>
  </div>;
}

function TotalCard({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) { return <div className="rounded-xl border border-[#2d7dff]/15 bg-black/50 p-3"><p className="text-[10px] uppercase tracking-[0.12em] text-zinc-500">{label}</p><p className={`mt-1 font-semibold ${emphasis ? "text-[#bafcfc]" : "text-white"}`}>{value}</p></div>; }

function AgreementEditor({ agreement, customers }: { agreement: ServiceAgreement; customers: Customer[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<FormState>(fromAgreement(agreement));
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, success: string) => { setError(null); setMessage(null); startTransition(async () => { const result = await fn(); if (!result.ok) { setError(result.error ?? "Action failed."); return; } setMessage(success); router.refresh(); }); };
  const save = () => run(() => updateServiceAgreementAction({ ...toInput(state), id: agreement.id }), "Plan updated.");
  const setStatus = (status: "proposed" | "active" | "cancelled") => run(() => setServiceAgreementStatusAction(agreement.id, status), `Plan status changed to ${status}.`);
  const customerUrl = () => `${window.location.origin}/agreement/${agreement.portalToken}`;
  const copy = async () => { try { await navigator.clipboard.writeText(customerUrl()); setMessage("Customer plan link copied."); } catch { setError("Could not copy the link on this device."); } };
  const email = () => { const recipient = agreement.customerEmail ?? ""; window.location.href = `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(`Chill Bros ${agreement.title}`)}&body=${encodeURIComponent(`Review your custom Chill Bros monthly service plan: ${customerUrl()}`)}`; };

  return <details className="rounded-2xl border border-[#2d7dff]/15 bg-zinc-950/70 p-4"><summary className="flex cursor-pointer list-none items-center justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><p className="font-medium text-white">{agreement.title}</p><StatusPill tone={agreement.status === "active" || agreement.status === "accepted" ? "emerald" : agreement.status === "cancelled" ? "rose" : "amber"}>{agreement.status}</StatusPill></div><p className="mt-1 text-xs text-zinc-500">{agreement.agreementNumber} • {money(agreement.monthlyTotal)}/month</p></div><FileText className="h-4 w-4 text-[#bafcfc]" /></summary><div className="mt-4 space-y-4"><AgreementFields state={state} setState={setState} customers={customers} />{error ? <p className="text-xs text-rose-300">{error}</p> : null}{message ? <p className="text-xs text-emerald-300">{message}</p> : null}<div className="flex flex-wrap gap-2"><button type="button" onClick={save} disabled={pending} className="inline-flex items-center gap-2 rounded-xl border border-[#2d7dff]/30 px-3 py-2 text-xs text-[#d9fbff] disabled:opacity-50"><Save className="h-3.5 w-3.5" />Save changes</button><Link href={`/agreement/${agreement.portalToken}`} className="inline-flex items-center gap-2 rounded-xl border border-[#2d7dff]/30 px-3 py-2 text-xs text-[#d9fbff]"><Send className="h-3.5 w-3.5" />Customer quote</Link><Link href={`/agreement/${agreement.portalToken}/document`} className="inline-flex items-center gap-2 rounded-xl border border-[#2d7dff]/30 px-3 py-2 text-xs text-[#d9fbff]"><FileText className="h-3.5 w-3.5" />Document</Link><button type="button" onClick={copy} className="inline-flex items-center gap-2 rounded-xl border border-[#2d7dff]/30 px-3 py-2 text-xs text-[#d9fbff]"><Copy className="h-3.5 w-3.5" />Copy link</button><button type="button" onClick={email} className="inline-flex items-center gap-2 rounded-xl border border-[#2d7dff]/30 px-3 py-2 text-xs text-[#d9fbff]"><Mail className="h-3.5 w-3.5" />Email</button>{agreement.status === "accepted" ? <button type="button" onClick={() => setStatus("active")} className="rounded-xl border border-emerald-500/30 px-3 py-2 text-xs text-emerald-200">Activate plan</button> : null}{agreement.status === "cancelled" ? <button type="button" onClick={() => setStatus("proposed")} className="rounded-xl border border-amber-500/30 px-3 py-2 text-xs text-amber-200">Reopen proposal</button> : <button type="button" onClick={() => setStatus("cancelled")} className="inline-flex items-center gap-2 rounded-xl border border-rose-500/25 px-3 py-2 text-xs text-rose-200"><XCircle className="h-3.5 w-3.5" />Cancel plan</button>}</div></div></details>;
}
