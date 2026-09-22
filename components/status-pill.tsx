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
  return <span className={`inline-flex rounded-md px-2.5 py-1 font-brand text-xs font-medium uppercase tracking-[0.06em] ${toneMap[tone]}`}>{children}</span>;
}
