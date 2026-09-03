import type { ReactNode } from "react";

type StatusPillProps = {
  children: ReactNode;
  tone?: "cyan" | "emerald" | "amber" | "rose";
};

const toneMap = {
  cyan: "neon-tube bg-[#2d7dff]/10 text-[#d9fbff]",
  emerald: "border-[#2d7dff]/70 bg-[#2d7dff]/10 text-[#d9fbff] shadow-[0_0_7px_rgba(45,125,255,0.65)]",
  amber: "border-[#2d7dff]/70 bg-[#2d7dff]/10 text-[#d9fbff] shadow-[0_0_7px_rgba(45,125,255,0.65)]",
  rose: "border-[#2d7dff]/70 bg-[#2d7dff]/10 text-[#d9fbff] shadow-[0_0_7px_rgba(45,125,255,0.65)]",
};

export function StatusPill({ children, tone = "cyan" }: StatusPillProps) {
  return <span className={`inline-flex rounded-full border px-3 py-1 font-brand text-xs font-medium uppercase tracking-[0.08em] ${toneMap[tone]}`}>{children}</span>;
}
