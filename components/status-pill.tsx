import type { ReactNode } from "react";

type StatusPillProps = {
  children: ReactNode;
  tone?: "cyan" | "emerald" | "amber" | "rose";
};

const toneMap = {
  cyan: "box sub",
  emerald: "box sub",
  amber: "box sub",
  rose: "danger-box txt",
};

export function StatusPill({ children, tone = "cyan" }: StatusPillProps) {
  return <span className={`inline-flex rounded-full px-3 py-1 font-brand text-xs font-medium uppercase tracking-[0.08em] ${toneMap[tone]}`}>{children}</span>;
}
