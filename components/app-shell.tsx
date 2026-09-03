import Link from "next/link";
import type { ReactNode } from "react";
import { Bell, LogOut, Snowflake } from "lucide-react";

import { navItems } from "@/lib/chillbros/nav";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import { signOutAction } from "@/app/sign-in/actions";
import { LogoBadge } from "@/components/logo-badge";
import { StatusPill } from "@/components/status-pill";

type AppShellProps = {
  children: ReactNode;
  title: string;
  description: string;
  highlight?: ReactNode;
};

export async function AppShell({ children, title, description, highlight }: AppShellProps) {
  const profile = await getCurrentStaffProfile();
  const visibleNavItems = profile?.role === "manager" ? navItems : navItems.filter((item) => item.href !== "/manager");

  return (
    <div className="min-h-screen bg-transparent text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 pb-10 pt-4 sm:px-6 lg:px-8">
        <header className="sticky top-0 z-20 mb-6 neon-frame sign-surface rounded-3xl px-4 py-4 backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <LogoBadge variant="full" className="w-14 shrink-0" />
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill>Internal operational app</StatusPill>
                  <StatusPill tone="emerald">Mobile ready</StatusPill>
                </div>
                <div className="w-full max-w-[15rem] sm:max-w-[18rem]">
                  <LogoBadge variant="text" className="w-full" />
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <div className="inline-flex items-center gap-2 rounded-full border neon-tube px-3 py-2 text-[#d9fbff]">
                <Bell className="h-4 w-4" />
                All automated notices copy chillbrostx@gmail.com
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border neon-tube px-3 py-2 text-[#d9fbff]">
                <Snowflake className="h-4 w-4" />
                Supabase-backed role model
              </div>
              {profile ? (
                <form action={signOutAction} className="inline-flex">
                  <div className="inline-flex items-center gap-2 rounded-full border neon-tube px-3 py-2 text-[#d9fbff]">
                    <span>{profile.fullName} · {profile.role === "manager" ? "Manager" : "Technician"}</span>
                    <button type="submit" className="inline-flex items-center gap-1 rounded-full border neon-tube px-2 py-1 text-xs transition hover:bg-[#2d7dff]/15" aria-label="Sign out">
                      <LogOut className="h-3.5 w-3.5" />
                      Sign out
                    </button>
                  </div>
                </form>
              ) : null}
            </div>
          </div>
          <nav className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {visibleNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="whitespace-nowrap rounded-full border neon-tube px-4 py-2 font-brand text-sm uppercase tracking-[0.12em] text-[#d9fbff] transition hover:bg-[#2d7dff]/15"
              >
                <span className="sm:hidden">{item.shortLabel}</span>
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            ))}
          </nav>
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
