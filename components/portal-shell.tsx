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
    <div className="min-h-screen bg-transparent text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 pb-10 pt-4 sm:px-6 lg:px-8">
        <header className="sticky top-0 z-20 mb-6 neon-frame sign-surface rounded-3xl px-4 py-4 backdrop-blur">
          <div className="flex items-center gap-4">
            <LogoBadge variant="full" className="w-14 shrink-0" />
            <div className="w-full max-w-[15rem] sm:max-w-[18rem]">
              <LogoBadge variant="text" className="w-full" />
            </div>
          </div>
        </header>

        <div className="mb-6 grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
          <section className="neon-frame sign-surface rounded-3xl bg-gradient-to-br from-[#2d7dff]/15 via-background to-background p-6">
            <p className="font-brand text-xs font-semibold uppercase tracking-[0.3em] text-[#8ffafa]">Chill Bros operational command center</p>
            <h1 className="neon-text mt-3 text-3xl font-semibold text-white sm:text-4xl">{title}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-300 sm:text-base">{description}</p>
          </section>
          <section className="neon-frame sign-surface rounded-3xl p-5">
            {highlight}
          </section>
        </div>

        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
