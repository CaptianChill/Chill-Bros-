import Image from "next/image";
import type { ReactNode } from "react";
import { Lock } from "lucide-react";

export const BUSINESS = {
  legalName: "Chill Professionals LLC",
  brand: "Chill Pros",
  city: "San Antonio, Texas",
  email: "chillprostx@gmail.com",
};

// Brand palette taken from the Chill Pros ice logo: black Texas, electric
// blue outline, ice-blue lettering, white.
export const BRAND = {
  ink: "#05070A",
  electric: "#1F6FEB",
  ice: "#9CCBFF",
  frost: "#EAF3FF",
};

/**
 * Customer-facing frame for secure document links: black header with the
 * Chill Pros ice logo and an electric-blue edge, frosted page, black footer.
 * Staff screens keep their own look; this is only for customers.
 */
export function PortalFrame({ children, eyebrow }: { children: ReactNode; eyebrow?: string }) {
  return (
    <div className="cb-portal flex min-h-dvh flex-col bg-[#EEF4FB] text-[#0B1220]">
      <header className="relative overflow-hidden bg-[#05070A] text-white">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(156,203,255,0.22),transparent_60%)]" aria-hidden="true" />
        <div className="relative mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6 sm:py-3">
          <Image src="/brand/chill-pros-ice-logo.png" alt="Chill Pros" width={900} height={900} priority className="h-[72px] w-[72px] shrink-0 object-contain drop-shadow-[0_0_14px_rgba(31,111,235,0.45)] sm:h-24 sm:w-24" />
          <div className="text-right">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#9CCBFF] sm:text-[12px]">HVAC &amp; Refrigeration</p>
            <p className="mt-0.5 flex items-center justify-end gap-1.5 text-[12px] font-semibold text-white/85 sm:text-[13px]">
              <Lock className="h-3.5 w-3.5 text-[#9CCBFF]" aria-hidden="true" />
              {eyebrow ?? "Secure customer portal"}
            </p>
          </div>
        </div>
        <div className="relative h-[3px] bg-gradient-to-r from-[#1F6FEB] via-[#9CCBFF] to-[#1F6FEB]" aria-hidden="true" />
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-5 sm:px-6 sm:py-8">{children}</main>

      <footer className="bg-[#05070A] text-white">
        <div className="h-[3px] bg-gradient-to-r from-[#1F6FEB] via-[#9CCBFF] to-[#1F6FEB]" aria-hidden="true" />
        <div className="mx-auto flex max-w-4xl items-center gap-4 px-4 py-5 sm:px-6">
          <Image src="/brand/chill-pros-ice-logo-240.png" alt="" width={240} height={240} className="h-14 w-14 shrink-0 object-contain" />
          <div className="min-w-0 text-sm">
            <p className="font-bold">{BUSINESS.legalName}</p>
            <p className="text-white/70">HVAC &amp; commercial refrigeration · {BUSINESS.city}</p>
            <a href={`mailto:${BUSINESS.email}`} style={{ color: "#9CCBFF" }} className="font-semibold underline-offset-2 hover:underline">{BUSINESS.email}</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function PortalCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-[#D3E1F2] bg-white shadow-[0_1px_3px_rgba(5,7,10,0.08)] ${className}`}>{children}</section>;
}
