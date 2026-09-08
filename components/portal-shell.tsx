import type { ReactNode } from "react";

import { LogoBadge } from "@/components/logo-badge";

type PortalShellProps = {
  children: ReactNode;
  title: string;
  description?: string;
  highlight?: ReactNode;
};

/** Client-facing shell for secure customer document links. */
export function PortalShell({ children, title, highlight }: PortalShellProps) {
  return (
    <div className="min-h-screen bg-transparent text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 pb-10 pt-4 sm:px-6 lg:px-8">
        <header className="sticky top-0 z-20 mb-4 neon-frame sign-surface rounded-3xl px-4 py-3 backdrop-blur">
          <div className="flex items-center gap-4">
            <LogoBadge variant="full" className="w-12 shrink-0" />
            <div className="w-full max-w-[14rem] sm:max-w-[17rem]">
              <LogoBadge variant="text" className="w-full" />
            </div>
          </div>
        </header>

        <div className="mb-4 grid gap-3 lg:grid-cols-[1.35fr_0.65fr]">
          <section className="neon-frame sign-surface rounded-3xl bg-gradient-to-br from-[#2d7dff]/12 via-background to-background p-5">
            <h1 className="neon-text text-2xl font-semibold text-white sm:text-3xl">{title}</h1>
          </section>
          {highlight ? <section className="neon-frame sign-surface rounded-3xl p-4">{highlight}</section> : null}
        </div>

        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
