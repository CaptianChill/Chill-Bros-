import type { ReactNode } from "react";

type SectionCardProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
};

export function SectionCard({ title, children, className = "" }: SectionCardProps) {
  return (
    <section className={`panel neon-frame sign-surface rounded-2xl p-3 text-center backdrop-blur sm:p-3.5 ${className}`}>
      <div className="mb-2 text-center">
        <h2 className="glo text-lg font-semibold leading-tight text-white sm:text-xl">{title}</h2>
      </div>
      <div className="txt">{children}</div>
    </section>
  );
}
