import Link from "next/link";
import type { ReactNode } from "react";

type MetricTone = "default" | "cyan" | "emerald" | "amber" | "rose";
type MetricSize = "default" | "lg";

type MetricCardProps = {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: MetricTone;
  href?: string;
  size?: MetricSize;
};

const valueTone: Record<MetricTone, string> = {
  default: "text-white",
  cyan: "text-[var(--saber)]",
  emerald: "text-emerald-300",
  amber: "text-amber-300",
  rose: "text-rose-300",
};

const valueSize: Record<MetricSize, string> = {
  default: "mt-1 text-xl font-semibold",
  lg: "mt-2 text-4xl font-bold",
};

const labelSize: Record<MetricSize, string> = {
  default: "text-[11px] text-zinc-500",
  lg: "text-xs font-semibold uppercase tracking-[0.12em] text-zinc-400",
};

const padding: Record<MetricSize, string> = {
  default: "p-2.5",
  lg: "p-5",
};

export function MetricCard({ label, value, hint, tone = "default", href, size = "default" }: MetricCardProps) {
  const content = (
    <>
      <p className={labelSize[size]}>{label}</p>
      <p className={`${valueSize[size]} ${valueTone[tone]}`}>{value}</p>
      {hint ? <p className="mt-0.5 truncate text-[10px] text-zinc-500">{hint}</p> : null}
    </>
  );

  const className = `rounded-lg border border-white/10 bg-white/[0.02] text-center transition ${padding[size]}`;

  if (href) {
    return (
      <Link href={href} className={`${className} block hover:border-[var(--saber-soft)] hover:bg-white/[0.04]`}>
        {content}
      </Link>
    );
  }

  return <div className={className}>{content}</div>;
}
