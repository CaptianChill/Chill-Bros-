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
      className={`neon-frame sign-surface rounded-3xl p-5 backdrop-blur ${className}`}
    >
      <div className="mb-4 space-y-1">
        {eyebrow ? <p className="font-brand text-xs font-semibold uppercase tracking-[0.3em] text-[#8ffafa]">{eyebrow}</p> : null}
        <h2 className="text-xl font-semibold text-white">{title}</h2>
        {description ? <p className="text-sm text-zinc-400">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}
