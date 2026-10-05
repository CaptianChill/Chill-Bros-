"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Check, FileText, Mail, MessageSquare, Send } from "lucide-react";

import { createServiceAgreementAction } from "@/lib/chillbros/service-agreement-actions";
import type { Customer } from "@/lib/chillbros/types";

const LABOR_RATE = 80;
const DEFAULT_TRIP_COST = 35;
const DEFAULT_RISK_PERCENT = 10;

const TIERS = {
  silver: {
    label: "Silver Essential",
    subtitle: "Core preventive coverage",
    visitsPerMonth: 1,
    hoursPerVisit: 1.5,
    targetMargin: 40,
    laborDiscount: 0,
    partsDiscount: 0,
    services: [
      "Scheduled preventive-maintenance visit and trip included",
      "HVAC / refrigeration visual inspection and operating checks",
      "Thermostat, controls, drain, belt, coil, gasket, and electrical checks as applicable",
      "Written service report with recommendations",
      "Standard scheduling priority",
      "Repair labor billed at the customer service-plan rate",
    ],
  },
  gold: {
    label: "Gold Protection",
    subtitle: "Balanced protection and savings",
    visitsPerMonth: 1,
    hoursPerVisit: 3,
    targetMargin: 35,
    laborDiscount: 10,
    partsDiscount: 5,
    services: [
      "Everything included in Silver Essential",
      "Expanded HVAC, refrigeration, ice-machine, and kitchen-equipment checks as selected",
      "Scheduled preventive-maintenance visit and trip included",
      "Priority scheduling",
      "Detailed service reporting and equipment recommendations",
      "10% repair-labor discount on eligible work",
      "5% discount from standard service-plan parts selling price on eligible repairs",
    ],
  },
  diamond: {
    label: "Diamond Operations",
    subtitle: "Highest service level and customer value",
    visitsPerMonth: 2,
    hoursPerVisit: 3,
    targetMargin: 30,
    laborDiscount: 20,
    partsDiscount: 10,
    services: [
      "Everything included in Gold Protection",
      "Two scheduled preventive-maintenance visits per month with trips included",
      "Full equipment / asset-management focus",
      "Highest service-plan scheduling priority",
      "Detailed condition reporting and repair planning",
      "20% repair-labor discount on eligible work",
      "10% discount from standard service-plan parts selling price on eligible repairs",
    ],
  },
} as const;

type TierKey = keyof typeof TIERS;

type Props = {
  customers: Customer[];
  initialCustomerId?: string;
};

const money = (value: number) => value.toLocaleString("en-US", { style: "currency", currency: "USD" });
const num = (value: string) => Math.max(0, Number(value) || 0);

export function ServicePlanSalesProposalBuilder({ customers, initialCustomerId }: Props) {
  const startingCustomer = initialCustomerId && customers.some((customer) => customer.id === initialCustomerId) ? initialCustomerId : "";
  const [customerId, setCustomerId] = useState(startingCustomer);
  const [tierKey, setTierKey] = useState<TierKey>("gold");
  const [visitsPerMonth, setVisitsPerMonth] = useState(String(TIERS.gold.visitsPerMonth));
  const [hoursPerVisit, setHoursPerVisit] = useState(String(TIERS.gold.hoursPerVisit));
  const [tripCost, setTripCost] = useState(String(DEFAULT_TRIP_COST));
  const [monthlyPartsCost, setMonthlyPartsCost] = useState("0");
  const [riskPercent, setRiskPercent] = useState(String(DEFAULT_RISK_PERCENT));
  const [monthlyPriceOverride, setMonthlyPriceOverride] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ agreementNumber: string; portalToken: string } | null>(null);

  const tier = TIERS[tierKey];
  const customer = customers.find((item) => item.id === customerId) ?? null;

  const economics = useMemo(() => {
    const visits = Math.max(1, Math.floor(num(visitsPerMonth) || 1));
    const hours = num(hoursPerVisit);
    const scheduledLabor = visits * hours * LABOR_RATE;
    const scheduledTrips = visits * num(tripCost);
    const partsSellingAllowance = num(monthlyPartsCost) * 2;
    const deliveryBeforeRisk = scheduledLabor + scheduledTrips + partsSellingAllowance;
    const riskReserve = deliveryBeforeRisk * (Math.min(100, num(riskPercent)) / 100);
    const protectedDeliveryCost = deliveryBeforeRisk + riskReserve;
    const margin = Math.min(80, Math.max(0, tier.targetMargin)) / 100;
    const suggestedMonthly = protectedDeliveryCost > 0 ? protectedDeliveryCost / (1 - margin) : 0;
    const finalMonthly = monthlyPriceOverride.trim() ? num(monthlyPriceOverride) : suggestedMonthly;
    return { visits, hours, scheduledLabor, scheduledTrips, partsSellingAllowance, riskReserve, protectedDeliveryCost, suggestedMonthly, finalMonthly };
  }, [hoursPerVisit, monthlyPartsCost, monthlyPriceOverride, riskPercent, tier.targetMargin, tripCost, visitsPerMonth]);

  const selectTier = (next: TierKey) => {
    const selected = TIERS[next];
    setTierKey(next);
    setVisitsPerMonth(String(selected.visitsPerMonth));
    setHoursPerVisit(String(selected.hoursPerVisit));
    setMonthlyPriceOverride("");
    setSaved(null);
    setError(null);
  };

  const saveProposal = () => {
    if (!customerId) { setError("Choose a customer first."); return; }
    if (economics.finalMonthly <= 0) { setError("Enter enough cost information to calculate a package price, or set a monthly price override."); return; }
    setError(null);
    startTransition(async () => {
      const result = await createServiceAgreementAction({
        customerId,
        title: `${tier.label} Service Plan`,
        calculationMode: "flat",
        visitsPerMonth: economics.visits,
        hoursPerVisit: economics.hours,
        hourlyRate: LABOR_RATE,
        monthlyFlatRate: Number(economics.finalMonthly.toFixed(2)),
        preferredDays: [],
        preferredTimeWindow: "",
        startDate: "",
        endDate: "",
        servicesIncluded: tier.services.join("\n"),
        customerPreferences: notes,
        terms: `This ${tier.label} plan is billed monthly. Scheduled preventive-maintenance visits and their normal trip charges are included in the package price. Work outside the included scope, emergency work, specialty parts, and added equipment may be quoted separately. Eligible repair labor receives a ${tier.laborDiscount}% plan discount and eligible repair parts receive a ${tier.partsDiscount}% discount from the standard service-plan parts selling price. Final coverage is subject to the approved agreement.`,
        setupFee: 0,
        discountType: null,
        discountValue: 0,
      });
      if (!result.ok) { setError(result.error); return; }
      setSaved({ agreementNumber: result.data.agreementNumber, portalToken: result.data.portalToken });
    });
  };

  const shareUrl = saved ? `${window.location.origin}/agreement/${saved.portalToken}` : "";
  const sendText = () => {
    if (!saved || !customer?.phone) return;
    window.location.href = `sms:${customer.phone.replace(/[^+\d]/g, "")}?&body=${encodeURIComponent(`Chill Pros ${tier.label} service plan: ${shareUrl}`)}`;
  };
  const sendEmail = () => {
    if (!saved) return;
    window.location.href = `mailto:${encodeURIComponent(customer?.email ?? "")}?subject=${encodeURIComponent(`Chill Pros ${tier.label} Service Plan`)}&body=${encodeURIComponent(`Here is your Chill Pros service plan proposal. Review and approve it here: ${shareUrl}`)}`;
  };

  return <div className="space-y-5">
    {saved ? <div className="rounded-2xl border border-emerald-500/35 bg-emerald-500/10 p-4">
      <div className="flex items-start gap-3"><Check className="mt-0.5 h-5 w-5 text-emerald-300" /><div><p className="font-semibold text-emerald-100">{saved.agreementNumber} ready for {customer?.name ?? "customer"}</p><p className="mt-1 text-sm text-emerald-200/80">{tier.label} at {money(economics.finalMonthly)}/month. The customer proposal and printable document are live now.</p></div></div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <button type="button" onClick={sendText} disabled={!customer?.phone} className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-400/30 px-3 py-2 text-xs text-emerald-100 disabled:opacity-40"><MessageSquare className="h-4 w-4" />Text</button>
        <button type="button" onClick={sendEmail} className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-400/30 px-3 py-2 text-xs text-emerald-100"><Mail className="h-4 w-4" />Email</button>
        <Link href={`/agreement/${saved.portalToken}`} target="_blank" className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-400/30 px-3 py-2 text-xs text-emerald-100"><Send className="h-4 w-4" />Customer view</Link>
        <Link href={`/agreement/${saved.portalToken}/document`} target="_blank" className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-400/30 px-3 py-2 text-xs text-emerald-100"><FileText className="h-4 w-4" />Print / PDF</Link>
      </div>
    </div> : null}

    <div className="grid gap-3 lg:grid-cols-[1.1fr_2fr]">
      <label className="space-y-1"><span className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">Customer</span><select value={customerId} onChange={(event) => { setCustomerId(event.target.value); setSaved(null); }} className="w-full rounded-xl border border-[#2d7dff]/20 bg-zinc-950 px-3 py-2.5 text-white"><option value="">Choose customer</option>{customers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <div className="grid grid-cols-3 gap-2">{(Object.keys(TIERS) as TierKey[]).map((key) => { const item = TIERS[key]; return <button key={key} type="button" onClick={() => selectTier(key)} className={`rounded-xl border p-3 text-left ${tierKey === key ? "border-[#8ffafa]/60 bg-[#2d7dff]/15" : "border-[#2d7dff]/20 bg-black/25"}`}><p className="text-sm font-semibold text-white">{item.label}</p><p className="mt-1 text-xs text-zinc-400">{item.subtitle}</p><p className="mt-2 text-[11px] text-[#bafcfc]">{item.laborDiscount}% labor · {item.partsDiscount}% parts discount</p></button>; })}</div>
    </div>

    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      <label className="space-y-1"><span className="text-[10px] uppercase tracking-wide text-zinc-500">Visits / month</span><input type="number" min="1" value={visitsPerMonth} onChange={(e) => { setVisitsPerMonth(e.target.value); setMonthlyPriceOverride(""); }} className="w-full rounded-xl border border-[#2d7dff]/20 bg-zinc-950 px-3 py-2 text-white" /></label>
      <label className="space-y-1"><span className="text-[10px] uppercase tracking-wide text-zinc-500">Hours / visit</span><input type="number" min="0" step="0.25" value={hoursPerVisit} onChange={(e) => { setHoursPerVisit(e.target.value); setMonthlyPriceOverride(""); }} className="w-full rounded-xl border border-[#2d7dff]/20 bg-zinc-950 px-3 py-2 text-white" /></label>
      <label className="space-y-1"><span className="text-[10px] uppercase tracking-wide text-zinc-500">Trip / visit</span><input type="number" min="0" step="0.01" value={tripCost} onChange={(e) => { setTripCost(e.target.value); setMonthlyPriceOverride(""); }} className="w-full rounded-xl border border-[#2d7dff]/20 bg-zinc-950 px-3 py-2 text-white" /></label>
      <label className="space-y-1"><span className="text-[10px] uppercase tracking-wide text-zinc-500">Parts cost / mo</span><input type="number" min="0" step="0.01" value={monthlyPartsCost} onChange={(e) => { setMonthlyPartsCost(e.target.value); setMonthlyPriceOverride(""); }} className="w-full rounded-xl border border-[#2d7dff]/20 bg-zinc-950 px-3 py-2 text-white" /></label>
      <label className="space-y-1"><span className="text-[10px] uppercase tracking-wide text-zinc-500">Risk reserve %</span><input type="number" min="0" max="100" step="1" value={riskPercent} onChange={(e) => { setRiskPercent(e.target.value); setMonthlyPriceOverride(""); }} className="w-full rounded-xl border border-[#2d7dff]/20 bg-zinc-950 px-3 py-2 text-white" /></label>
    </div>

    <div className="grid gap-3 rounded-2xl border border-[#2d7dff]/20 bg-black/30 p-4 sm:grid-cols-4">
      <div><p className="text-[10px] uppercase tracking-wide text-zinc-500">Scheduled labor @ $80/hr</p><p className="mt-1 font-semibold text-white">{money(economics.scheduledLabor)}</p></div>
      <div><p className="text-[10px] uppercase tracking-wide text-zinc-500">Trips included</p><p className="mt-1 font-semibold text-white">{money(economics.scheduledTrips)}</p></div>
      <div><p className="text-[10px] uppercase tracking-wide text-zinc-500">Parts allowance @ 2× cost</p><p className="mt-1 font-semibold text-white">{money(economics.partsSellingAllowance)}</p></div>
      <div><p className="text-[10px] uppercase tracking-wide text-zinc-500">Suggested {tier.label}</p><p className="mt-1 text-lg font-bold text-[#bafcfc]">{money(economics.suggestedMonthly)}/mo</p></div>
    </div>

    <div className="grid gap-3 sm:grid-cols-[220px_1fr]">
      <label className="space-y-1"><span className="text-[11px] uppercase tracking-wide text-zinc-500">Final monthly price</span><input type="number" min="0" step="0.01" value={monthlyPriceOverride || economics.suggestedMonthly.toFixed(2)} onChange={(e) => setMonthlyPriceOverride(e.target.value)} className="w-full rounded-xl border border-[#8ffafa]/40 bg-zinc-950 px-3 py-2.5 text-lg font-semibold text-[#bafcfc]" /></label>
      <label className="space-y-1"><span className="text-[11px] uppercase tracking-wide text-zinc-500">Customer / site notes</span><input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Priority equipment, access instructions, special coverage notes…" className="w-full rounded-xl border border-[#2d7dff]/20 bg-zinc-950 px-3 py-2.5 text-white" /></label>
    </div>

    <div className="rounded-xl border border-[#2d7dff]/15 bg-black/25 p-3 text-xs text-zinc-400"><p><span className="font-semibold text-zinc-200">Internal math:</span> scheduled labor + trips + parts at 2× company cost + {Number(riskPercent) || 0}% reserve, then priced to the {tier.targetMargin}% target gross margin for {tier.label}. Parts markup stays internal and is not shown on the customer proposal.</p></div>

    {error ? <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</p> : null}
    <button type="button" onClick={saveProposal} disabled={pending || !customerId} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1B3FD0] px-4 py-3 font-semibold text-white transition hover:bg-[#1530A8] disabled:opacity-50"><FileText className="h-5 w-5" />{pending ? "Creating proposal…" : `Create ${tier.label} customer proposal`}</button>
  </div>;
}
