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
        <header className="panel portal-header sticky top-0 z-20 mb-4 neon-frame sign-surface rounded-3xl px-4 py-3 backdrop-blur">
          <div className="flex items-center gap-4">
            <LogoBadge variant="full" className="w-12 shrink-0" />
            <div className="w-full max-w-[14rem] sm:max-w-[17rem]">
              <LogoBadge variant="text" className="w-full" />
            </div>
          </div>
        </header>

        <div className="mb-4 grid gap-3 lg:grid-cols-[1.35fr_0.65fr]">
          <section className="panel neon-frame sign-surface rounded-3xl p-5">
            <h1 className="glo text-2xl font-semibold sm:text-3xl">{title}</h1>
          </section>
          {highlight ? <section className="panel neon-frame sign-surface rounded-3xl p-4"><div className="txt">{highlight}</div></section> : null}
        </div>

        <main className="txt flex-1">{children}</main>
      </div>
    </div>
  );
}
