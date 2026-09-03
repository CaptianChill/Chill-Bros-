import type { ReactNode } from "react";

import { LogoBadge } from "@/components/logo-badge";

type PortalShellProps = {
  children: ReactNode;
  title: string;
  description: string;
  highlight?: ReactNode;
};

/**
 * Client-facing shell for /portal/[token] — no staff navigation, no
 * sign-out control, no auth lookup. The link itself (the unguessable
 * portal_token) is the only thing gating access here.
 */
export function PortalShell({ children, title, description, highlight }: PortalShellProps) {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 pb-10 pt-4 sm:px-6 lg:px-8">
        <header className="sticky top-0 z-20 mb-6 rounded-3xl border border-[#00f0f0]/40 bg-black/90 px-4 py-4 shadow-[0_0_45px_rgba(0,240,240,0.12)] backdrop-blur">
          <div className="flex items-center gap-4">
            <LogoBadge variant="icon" className="w-14 shrink-0" />
            <div className="w-full max-w-[15rem] sm:max-w-[18rem]">
              <LogoBadge variant="text" className="border-none bg-transparent shadow-none" />
            </div>
          </div>
        </header>

        <div className="mb-6 grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
          <section className="rounded-3xl border border-[#00f0f0]/40 bg-gradient-to-br from-[#00f0f0]/16 via-black to-black p-6 shadow-[0_0_55px_rgba(0,240,240,0.12)]">
            <p className="font-brand text-xs font-semibold uppercase tracking-[0.3em] text-[#8ffafa]">Chill Bros operational command center</p>
            <h1 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">{title}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-300 sm:text-base">{description}</p>
          </section>
          <section className="rounded-3xl border border-[#00f0f0]/40 bg-zinc-950/90 p-5 shadow-[0_0_45px_rgba(0,240,240,0.12)]">
            {highlight}
          </section>
        </div>

        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
