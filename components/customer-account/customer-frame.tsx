import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { BUSINESS } from "@/components/customer-portal/portal-frame";

/**
 * Customer homepage frame: black header with the Chill Pros Texas logo (plus
 * the clean wordmark on wider screens), frosted page, black footer.
 * Matches the design the owner approved on 2026-10-07.
 */
export function CustomerFrame({ children, accountName, right }: { children: ReactNode; accountName?: string | null; right?: ReactNode }) {
  return (
    <div className="cb-portal flex min-h-dvh flex-col bg-[#EEF4FB] text-[#0B1220]">
      <header className="bg-[#05070A] text-white pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-2 sm:px-6">
          <Link href="/my" className="flex items-center gap-3" aria-label="Chill Pros home">
            <Image src="/brand/chill-pros-ice-logo-240.png" alt="Chill Pros" width={240} height={240} priority className="h-[84px] w-[84px] shrink-0 object-contain drop-shadow-[0_0_10px_rgba(31,111,235,0.5)] sm:h-24 sm:w-24" />
            <Image src="/brand/chill-pros-wordmark-clean.png" alt="" width={1267} height={226} priority className="hidden h-8 w-auto drop-shadow-[0_0_10px_rgba(31,111,235,0.55)] sm:block" />
          </Link>
          <div className="min-w-0 text-right">
            {accountName ? (
              <>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#9CCBFF]">Your account</p>
                <p className="mt-0.5 max-w-[180px] truncate text-[13px] font-semibold text-white sm:max-w-xs">{accountName}</p>
              </>
            ) : (
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#9CCBFF]">HVAC &amp; Refrigeration</p>
            )}
            {right}
          </div>
        </div>
        <div className="h-[3px] bg-gradient-to-r from-[#1F6FEB] via-[#9CCBFF] to-[#1F6FEB]" aria-hidden="true" />
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-5 sm:px-6 sm:py-8">{children}</main>

      <footer className="bg-[#05070A] text-white pb-[env(safe-area-inset-bottom)]">
        <div className="h-[3px] bg-gradient-to-r from-[#1F6FEB] via-[#9CCBFF] to-[#1F6FEB]" aria-hidden="true" />
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-5 sm:px-6">
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

export function Card({ children, className = "", title }: { children: ReactNode; className?: string; title?: string }) {
  return (
    <section className={`rounded-2xl border border-[#D3E1F2] bg-white p-4 shadow-[0_1px_3px_rgba(5,7,10,0.08)] sm:p-5 ${className}`}>
      {title ? <h2 className="mb-3 text-[13px] font-bold uppercase tracking-[0.14em] text-[#3D5170]">{title}</h2> : null}
      {children}
    </section>
  );
}

export const money = (value: number) => value.toLocaleString("en-US", { style: "currency", currency: "USD" });
export const shortDate = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleDateString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", year: "numeric" }) : "";
