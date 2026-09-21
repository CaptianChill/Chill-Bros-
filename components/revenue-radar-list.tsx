"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { buildBattleCard, urgencyScore, type BattleCardLead } from "@/lib/chillbros/battle-card";

type Prospect = BattleCardLead & {
  id: string;
};

type StatusFilter = "all" | "hot" | "new" | "follow_up" | "quoted" | "won";
type ServiceFilter = "all" | "hvac_r" | "refrigeration" | "ice_machine" | "kitchen_equipment" | "exhaust_hood" | "multiple";
type SortMode = "score" | "newest" | "urgent";

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

const sortModes: Array<{ value: SortMode; label: string }> = [
  { value: "score", label: "Highest Score" },
  { value: "newest", label: "Newest" },
  { value: "urgent", label: "Most Urgent" },
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

function sortProspects(prospects: Prospect[], mode: SortMode) {
  const copy = [...prospects];
  if (mode === "newest") return copy.sort((a, b) => new Date(b.signal_observed_at).getTime() - new Date(a.signal_observed_at).getTime());
  if (mode === "urgent") return copy.sort((a, b) => urgencyScore(b) - urgencyScore(a));
  return copy.sort((a, b) => Number(b.score) - Number(a.score));
}

export function RevenueRadarList({ prospects }: { prospects: Prospect[] }) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [serviceFilter, setServiceFilter] = useState<ServiceFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("score");

  const visible = useMemo(() => {
    const filtered = prospects.filter((p) => {
      const statusMatch = matchesStatus(p, statusFilter);
      const serviceMatch = serviceFilter === "all" || p.service_line === serviceFilter;
      return statusMatch && serviceMatch;
    });
    return sortProspects(filtered, sortMode);
  }, [prospects, serviceFilter, statusFilter, sortMode]);

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

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <span>Sort:</span>
          <div className="flex gap-1">
            {sortModes.map((mode) => {
              const active = sortMode === mode.value;
              return <button
                key={mode.value}
                type="button"
                onClick={() => setSortMode(mode.value)}
                className={[
                  "min-h-8 shrink-0 rounded-lg border px-2.5 text-xs font-medium transition",
                  active
                    ? "border-cyan-400/70 bg-cyan-400/15 text-cyan-100"
                    : "border-white/10 bg-black/25 text-zinc-400 hover:text-white",
                ].join(" ")}
              >
                {mode.label}
              </button>;
            })}
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-zinc-400">
          <span>Showing <strong className="text-white">{visible.length}</strong> of {prospects.length} leads</span>
          {(statusFilter !== "all" || serviceFilter !== "all" || sortMode !== "score") ? <button
            type="button"
            onClick={() => { setStatusFilter("all"); setServiceFilter("all"); setSortMode("score"); }}
            className="text-cyan-200 underline underline-offset-2"
          >
            Reset filters
          </button> : null}
        </div>
      </div>
    </div>

    <div className="space-y-3">
      {visible.length === 0 ? <div className="rounded-2xl border border-white/15 bg-black/25 p-5 text-center text-sm text-zinc-400">
        No leads match these filters.
      </div> : visible.map((p) => {
        const card = buildBattleCard(p);
        return <Link key={p.id} href={"/revenue-radar/" + p.id} className="block rounded-2xl border border-cyan-400/25 bg-black/40 p-4 transition hover:border-cyan-300">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <strong className="text-lg text-white">{p.business_name}</strong>
            <p className="text-sm text-zinc-400">{p.city} · {p.service_line.replaceAll("_", " ")}</p>
          </div>
          <strong className="rounded-full bg-cyan-400/20 px-3 py-1 text-cyan-200">{p.score}/100</strong>
        </div>

        <span className={[
          "mt-2 inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]",
          card.isGeneric ? "border-zinc-500/40 bg-zinc-500/10 text-zinc-400" : "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
        ].join(" ")}>
          {card.leadKindLabel}
        </span>

        <div className="mt-3 rounded-xl border border-cyan-300/15 bg-cyan-400/5 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-200">Why now — score {p.score}/100</p>
          <p className="mt-1 text-sm text-zinc-100">{card.whyNow}</p>
        </div>

        <div className="mt-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Business</p>
          <p className="mt-1 text-sm text-zinc-200">{card.businessSummary}</p>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Decision-maker</p>
            {card.decisionMaker ? <>
              <p className="mt-1 text-sm text-white">{card.decisionMaker.name}</p>
              {card.decisionMaker.role ? <p className="text-xs text-zinc-400">{card.decisionMaker.role}</p> : null}
              <p className="mt-1 text-xs text-cyan-200">{[card.decisionMaker.phone, card.decisionMaker.email].filter(Boolean).join(" · ") || "Phone/email pending"}</p>
            </> : <p className="mt-1 text-sm text-zinc-400">Research pending</p>}
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Recommended offer</p>
            <p className="mt-1 text-sm text-zinc-200">{card.recommendedOffer}</p>
          </div>
        </div>

        <div className="mt-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Estimated opportunity</p>
          <p className="mt-1 text-sm text-zinc-200">{card.opportunitySummary}</p>
        </div>

        <div className="mt-3 rounded-xl border border-amber-300/20 bg-amber-400/5 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-200">Next action</p>
          <p className="mt-1 text-sm text-amber-100">{card.nextAction}</p>
        </div>

        <details className="mt-3 rounded-xl border border-white/10 bg-black/30 p-3">
          <summary className="cursor-pointer select-none text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
            Evidence &amp; details
          </summary>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-zinc-300">
            {card.evidence.map((line) => <li key={line} className="break-words">{line}</li>)}
          </ul>
          <p className="mt-2 text-xs text-zinc-400">{p.status.replaceAll("_", " ")} · observed {new Date(p.signal_observed_at).toLocaleDateString()}</p>
          {p.follow_up_at ? <p className="mt-1 text-xs text-cyan-200">Follow up {new Date(p.follow_up_at).toLocaleString()}</p> : null}
        </details>
      </Link>;
      })}
    </div>
  </section>;
}
