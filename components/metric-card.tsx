import Link from "next/link";
import type { ReactNode } from "react";

type MetricTone = "default" | "cyan" | "emerald" | "amber" | "rose";

type MetricCardProps = {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: MetricTone;
  href?: string;
};

const valueTone: Record<MetricTone, string> = {
  default: "text-white",
  cyan: "text-[#8ffafa]",
  emerald: "text-emerald-300",
  amber: "text-amber-300",
  rose: "text-rose-300",
};

export function MetricCard({ label, value, hint, tone = "default", href }: MetricCardProps) {
  const content = (
    <>
      <p className="text-[11px] text-zinc-500">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${valueTone[tone]}`}>{value}</p>
      {hint ? <p className="mt-0.5 truncate text-[10px] text-zinc-500">{hint}</p> : null}
    </>
  );

  const className = "rounded-xl border border-[#2d7dff]/20 bg-black/40 p-2.5 text-center transition";

  if (href) {
    return (
      <Link href={href} className={`${className} block hover:border-[#8ffafa]/45 hover:bg-[#2d7dff]/10`}>
        {content}
      </Link>
    );
  }

  return <div className={className}>{content}</div>;
}
