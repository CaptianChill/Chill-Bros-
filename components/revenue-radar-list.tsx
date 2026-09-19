"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { explainLeadRanking } from "@/lib/chillbros/revenue-sales";

type Prospect = {
  id: string;
  business_name: string;
  city: string;
  category: string;
  service_line: string;
  signal_summary: string;
  signal_verified: boolean;
  signal_observed_at: string;
  score: number;
  status: string;
  follow_up_at: string | null;
  actual_revenue: number | string | null;
  direct_cost: number | string | null;
  business_address: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  contact_name: string | null;
  contact_role: string | null;
  verification_status: string | null;
  source_url: string;
};

type StatusFilter = "all" | "hot" | "new" | "follow_up" | "quoted" | "won";
type ServiceFilter = "all" | "hvac_r" | "refrigeration" | "ice_machine" | "kitchen_equipment" | "exhaust_hood" | "multiple";

const statusFilters: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "All Leads" },
  { value: "hot", label: "Hot Leads" },
  { value: "new", label: "New" },
  { value: "follow_up", label: "Follow-Up" },
  { value: "quoted", label: "Quoted" },
  { value: "won", label: "Won" },
];

const serviceFilters: Array<{ value: ServiceFilter; label: string }> = [
  { value: "all", label: "All Services" },
  { value: "hvac_r", label: "HVAC" },
  { value: "refrigeration", label: "Refrigeration" },
  { value: "ice_machine", label: "Ice" },
  { value: "kitchen_equipment", label: "Kitchen Equipment" },
  { value: "exhaust_hood", label: "Hood / Exhaust" },
  { value: "multiple", label: "Multiple" },
];

function matchesStatus(p: Prospect, filter: StatusFilter) {
  if (filter === "all") return true;
  if (filter === "hot") return Number(p.score) >= 65 && !["won", "lost"].includes(p.status);
  if (filter === "new") return p.status === "new";
  if (filter === "follow_up") return Boolean(p.follow_up_at) && !["won", "lost"].includes(p.status);
  if (filter === "quoted") return p.status === "quoted";
  if (filter === "won") return p.status === "won";
  return true;
}

function statusCount(prospects: Prospect[], filter: StatusFilter) {
  return prospects.filter((p) => matchesStatus(p, filter)).length;
}

export function RevenueRadarList({ prospects }: { prospects: Prospect[] }) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("hot");
  const [serviceFilter, setServiceFilter] = useState<ServiceFilter>("all");

  const visible = useMemo(() => {
    return prospects.filter((p) => {
      const statusMatch = matchesStatus(p, statusFilter);
      const serviceMatch = serviceFilter === "all" || p.service_line === serviceFilter;
      return statusMatch && serviceMatch;
    });
  }, [prospects, serviceFilter, statusFilter]);

  if (prospects.length === 0) {
    return <div className="rounded-2xl border border-white/20 p-6 text-center text-zinc-300">
      <p className="font-semibold text-white">No leads loaded yet.</p>
      <p className="mt-1 text-sm">Press <strong>Scan for leads</strong>. Revenue Radar will populate this list for you.</p>
    </div>;
  }

  return <section className="space-y-4">
    <div className="rounded-2xl border border-white/10 bg-black/35 p-3 sm:p-4">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {statusFilters.map((filter) => {
          const active = statusFilter === filter.value;
          const count = statusCount(prospects, filter.value);
          return <button
            key={filter.value}
            type="button"
            onClick={() => setStatusFilter(filter.value)}
            className={[
              "min-h-10 shrink-0 rounded-full border px-3 text-sm font-semibold transition",
              active
                ? "border-cyan-300 bg-cyan-300 text-black"
                : "border-white/15 bg-black/40 text-zinc-300 hover:border-cyan-300/60 hover:text-white",
            ].join(" ")}
          >
            {filter.label} <span className="ml-1 opacity-70">{count}</span>
          </button>;
        })}
      </div>

      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {serviceFilters.map((filter) => {
          const active = serviceFilter === filter.value;
          return <button
            key={filter.value}
            type="button"
            onClick={() => setServiceFilter(filter.value)}
            className={[
              "min-h-9 shrink-0 rounded-xl border px-3 text-xs font-medium transition",
              active
                ? "border-cyan-400/70 bg-cyan-400/15 text-cyan-100"
                : "border-white/10 bg-black/25 text-zinc-400 hover:text-white",
            ].join(" ")}
          >
            {filter.label}
          </button>;
        })}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-zinc-400">
        <span>Showing <strong className="text-white">{visible.length}</strong> of {prospects.length} leads</span>
        {(statusFilter !== "hot" || serviceFilter !== "all") ? <button
          type="button"
          onClick={() => { setStatusFilter("hot"); setServiceFilter("all"); }}
          className="text-cyan-200 underline underline-offset-2"
        >
          Reset filters
        </button> : null}
      </div>
    </div>

    <div className="space-y-3">
      {visible.length === 0 ? <div className="rounded-2xl border border-white/15 bg-black/25 p-5 text-center text-sm text-zinc-400">
        No leads match these filters.
      </div> : visible.map((p) => {
        const rankingReasons = explainLeadRanking({
          score: Number(p.score),
          category: p.category,
          serviceLine: p.service_line,
          signalSummary: p.signal_summary,
          signalVerified: p.signal_verified,
          verificationStatus: p.verification_status,
          observedAt: p.signal_observed_at,
          businessAddress: p.business_address,
          contactName: p.contact_name,
          contactPhone: p.contact_phone,
          contactEmail: p.contact_email,
        });
        return <Link key={p.id} href={"/revenue-radar/" + p.id} className="block rounded-2xl border border-cyan-400/25 bg-black/40 p-4 transition hover:border-cyan-300">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <strong className="text-lg text-white">{p.business_name}</strong>
            <p className="text-sm text-zinc-400">{p.city} · {p.service_line.replaceAll("_", " ")} · {p.business_address || "address research pending"}</p>
          </div>
          <strong className="rounded-full bg-cyan-400/20 px-3 py-1 text-cyan-200">{p.score}/100</strong>
        </div>
        <p className="mt-2 text-sm text-zinc-200">{p.signal_summary}</p>
        <p className="mt-2 text-xs text-zinc-400">{p.signal_verified ? "Verified directly" : p.verification_status === "source_verified" ? "Source verified" : "Auto-discovered public lead"} · {p.status.replaceAll("_", " ")} · {new Date(p.signal_observed_at).toLocaleDateString()}</p>
        <div className="mt-3 grid gap-2 rounded-xl border border-white/10 bg-black/30 p-3 sm:grid-cols-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Lead contact</p>
            <p className="mt-1 text-sm text-white">{p.contact_name || "Decision-maker research pending"}</p>
            {p.contact_role ? <p className="text-xs text-zinc-400">{p.contact_role}</p> : null}
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Contact details</p>
            <p className="mt-1 text-xs text-cyan-200">{p.contact_phone || "Phone pending"}</p>
            <p className="break-all text-xs text-cyan-200">{p.contact_email || "Email pending"}</p>
          </div>
        </div>
        <div className="mt-3 rounded-xl border border-cyan-300/15 bg-cyan-400/5 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-200">Why {p.score}/100</p>
          <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-zinc-300">
            {rankingReasons.slice(0, 4).map((reason) => <li key={reason}>{reason}</li>)}
          </ul>
        </div>
        {p.follow_up_at ? <p className="mt-1 text-xs text-cyan-200">Follow up {new Date(p.follow_up_at).toLocaleString()}</p> : null}
        {p.actual_revenue != null ? <p className="mt-1 text-xs text-cyan-200">Revenue ${Number(p.actual_revenue).toFixed(2)} · Gross profit ${((Number(p.actual_revenue) || 0) - (Number(p.direct_cost) || 0)).toFixed(2)}</p> : null}
      </Link>;
      })}
    </div>
  </section>;
}
