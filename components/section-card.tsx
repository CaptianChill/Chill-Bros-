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
    <section className={`neon-frame sign-surface rounded-2xl p-3.5 backdrop-blur sm:p-4.5 ${className}`}>
      <div className="mb-2.5 text-center sm:mb-3 sm:text-left">
        <h2 className="text-lg font-semibold leading-tight text-white sm:text-xl">{title}</h2>
      </div>
      {children}
    </section>
  );
}
