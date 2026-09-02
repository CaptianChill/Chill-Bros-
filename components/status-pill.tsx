import type { ReactNode } from "react";

type StatusPillProps = {
  children: ReactNode;
  tone?: "cyan" | "emerald" | "amber" | "rose";
};

const toneMap = {
  cyan: "border-[#00f0f0]/50 bg-[#00f0f0]/10 text-[#bafcfc]",
  emerald: "border-emerald-400/50 bg-emerald-500/10 text-emerald-200",
  amber: "border-amber-400/50 bg-amber-500/10 text-amber-200",
  rose: "border-rose-400/50 bg-rose-500/10 text-rose-200",
};

export function StatusPill({ children, tone = "cyan" }: StatusPillProps) {
  return <span className={`inline-flex rounded-full border px-3 py-1 font-brand text-xs font-medium uppercase tracking-[0.08em] ${toneMap[tone]}`}>{children}</span>;
}
