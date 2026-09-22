import type { ReactNode } from "react";

type SectionCardProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  id?: string;
};

export function SectionCard({ title, children, className = "", id }: SectionCardProps) {
  return (
    <section id={id} className={`panel neon-frame sign-surface rounded-xl p-3.5 text-center sm:p-4 ${className}`}>
      <div className="mb-2.5 text-center">
        <h2 className="glo text-base font-semibold leading-tight text-white sm:text-lg">{title}</h2>
      </div>
      <div className="txt">{children}</div>
    </section>
  );
}
