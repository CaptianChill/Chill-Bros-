import type { ReactNode } from "react";

type SectionCardProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
};

export function SectionCard({ eyebrow, title, description, children, className = "" }: SectionCardProps) {
  return (
    <section
      className={`rounded-3xl border border-cyan-400/40 bg-zinc-950/90 p-5 shadow-[0_0_45px_rgba(34,211,238,0.12)] backdrop-blur ${className}`}
    >
      <div className="mb-4 space-y-1">
        {eyebrow ? <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300">{eyebrow}</p> : null}
        <h2 className="text-xl font-semibold text-white">{title}</h2>
        {description ? <p className="text-sm text-zinc-400">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}
