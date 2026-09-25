import Image from "next/image";
import type { ReactNode } from "react";
import { Lock } from "lucide-react";

export const BUSINESS = {
  legalName: "Chill Professionals LLC",
  brand: "Chill Pros",
  city: "San Antonio, Texas",
  email: "chillprostx@gmail.com",
};

/**
 * Professional customer-facing frame for secure document links: navy brand
 * header with the Texas logo, light page, plain footer. Staff screens keep
 * their own look; this is only for customers.
 */
export function PortalFrame({ children, eyebrow }: { children: ReactNode; eyebrow?: string }) {
  return (
    <div className="cb-portal min-h-dvh bg-[#F3F6FA] text-[#0A1A33]">
      <header className="bg-[#0A1A33] text-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Image src="/brand/chill-pros-badge.png" alt="" width={120} height={120} priority className="h-12 w-12 shrink-0 object-contain sm:h-14 sm:w-14" />
            <Image src="/brand/chill-pros-wordmark-chrome-600.webp" alt="Chill Pros" width={600} height={185} priority className="h-auto w-28 sm:w-40" />
          </div>
          <p className="flex shrink-0 items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-[#9FD3FF]">
            <Lock className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only sm:not-sr-only">{eyebrow ?? "Secure customer portal"}</span>
          </p>
        </div>
        <div className="h-1 bg-gradient-to-r from-[#1557B0] via-[#9FD3FF] to-[#1557B0]" aria-hidden="true" />
      </header>

      <main className="mx-auto w-full max-w-4xl px-4 py-5 sm:px-6 sm:py-8">{children}</main>

      <footer className="border-t border-[#D5DEEA] bg-white">
        <div className="mx-auto flex max-w-4xl flex-col gap-1 px-4 py-5 text-sm text-[#4A5B74] sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="font-semibold text-[#0A1A33]">{BUSINESS.legalName}</p>
          <p>
            HVAC &amp; commercial refrigeration · {BUSINESS.city} ·{" "}
            <a href={`mailto:${BUSINESS.email}`} className="font-semibold text-[#1557B0] underline-offset-2 hover:underline">{BUSINESS.email}</a>
          </p>
        </div>
      </footer>
    </div>
  );
}

export function PortalCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-[#D5DEEA] bg-white shadow-[0_1px_3px_rgba(10,26,51,0.08)] ${className}`}>{children}</section>;
}
