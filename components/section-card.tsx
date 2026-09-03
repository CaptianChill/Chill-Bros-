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
    <section className={`neon-frame sign-surface rounded-2xl p-4 backdrop-blur sm:rounded-3xl sm:p-5 ${className}`}>
      <div className="mb-3 space-y-1 text-center sm:mb-4 sm:text-left">
        {eyebrow ? <p className="font-brand text-[10px] font-semibold uppercase tracking-[0.26em] text-[#8ffafa] sm:text-xs sm:tracking-[0.3em]">{eyebrow}</p> : null}
        <h2 className="text-lg font-semibold leading-tight text-white sm:text-xl">{title}</h2>
        {description ? <p className="text-sm leading-6 text-zinc-400">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}
