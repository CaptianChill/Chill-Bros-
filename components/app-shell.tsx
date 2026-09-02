import Link from "next/link";
import type { ReactNode } from "react";
import { Bell, Snowflake } from "lucide-react";

import { navItems } from "@/lib/mock-data";
import { LogoBadge } from "@/components/logo-badge";
import { StatusPill } from "@/components/status-pill";

type AppShellProps = {
  children: ReactNode;
  title: string;
  description: string;
  highlight?: ReactNode;
};

export function AppShell({ children, title, description, highlight }: AppShellProps) {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 pb-10 pt-4 sm:px-6 lg:px-8">
        <header className="sticky top-0 z-20 mb-6 rounded-3xl border border-cyan-400/40 bg-black/90 px-4 py-4 shadow-[0_0_45px_rgba(34,211,238,0.12)] backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <LogoBadge variant="icon" className="w-14 shrink-0" />
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill>Internal operational app</StatusPill>
                  <StatusPill tone="emerald">Mobile ready</StatusPill>
                </div>
                <div className="w-full max-w-[15rem] sm:max-w-[18rem]">
                  <LogoBadge variant="text" className="border-none bg-transparent shadow-none" />
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/40 px-3 py-2 text-cyan-100">
                <Bell className="h-4 w-4" />
                All automated notices copy chillbrostx@gmail.com
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/40 px-3 py-2 text-cyan-100">
                <Snowflake className="h-4 w-4" />
                Firebase-ready role model
              </div>
            </div>
          </div>
          <nav className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="whitespace-nowrap rounded-full border border-cyan-400/30 px-4 py-2 text-sm text-cyan-100 transition hover:border-cyan-300 hover:bg-cyan-400/10"
              >
                <span className="sm:hidden">{item.shortLabel}</span>
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            ))}
          </nav>
        </header>

        <div className="mb-6 grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
          <section className="rounded-3xl border border-cyan-400/40 bg-gradient-to-br from-cyan-500/10 via-black to-black p-6 shadow-[0_0_55px_rgba(34,211,238,0.12)]">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300">Chill Bros operational command center</p>
            <h1 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">{title}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-300 sm:text-base">{description}</p>
          </section>
          <section className="rounded-3xl border border-cyan-400/40 bg-zinc-950/90 p-5 shadow-[0_0_45px_rgba(34,211,238,0.12)]">
            {highlight}
          </section>
        </div>

        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
