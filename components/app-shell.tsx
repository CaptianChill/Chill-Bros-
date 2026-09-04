import Link from "next/link";
import type { ReactNode } from "react";
import { LogOut, Snowflake } from "lucide-react";

import { navItems } from "@/lib/chillbros/nav";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import { signOutAction } from "@/app/sign-in/actions";
import { LogoBadge } from "@/components/logo-badge";
import { PageSyncControls } from "@/components/page-sync-controls";
import { StatusPill } from "@/components/status-pill";

type AppShellProps = { children: ReactNode; title: string; description: string; highlight?: ReactNode };

export async function AppShell({ children, title, description, highlight }: AppShellProps) {
  const profile = await getCurrentStaffProfile();
  const visibleNavItems = profile ? navItems.filter((item) => item.roles.includes(profile.role)) : [];
  const roleLabel = profile?.role === "manager" ? "Manager" : profile?.role === "office" ? "Office / Dispatch" : "Technician";
  return <div className="min-h-screen bg-transparent text-foreground"><div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-3 pb-8 pt-2.5 sm:px-6 sm:pt-4 lg:px-8">
    <header className="sticky z-40 mb-3 rounded-2xl border border-[#2d7dff]/45 bg-[#020407]/98 px-3 py-2.5 shadow-[0_0_16px_rgba(45,125,255,0.36)] backdrop-blur-xl sm:mb-5 sm:rounded-3xl sm:px-4 sm:py-4" style={{ top: "max(env(safe-area-inset-top), 8px)", WebkitTransform: "translateZ(0)" }}>
      <div className="flex items-center gap-2.5 sm:gap-4"><LogoBadge variant="full" className="w-9 shrink-0 sm:w-12 lg:w-14" /><div className="min-w-0 flex-1"><div className="flex min-w-0 items-center gap-2"><div className="min-w-0 flex-1"><div className="truncate font-serif text-[1.55rem] font-black italic uppercase leading-none tracking-[0.015em] text-[#071126] [-webkit-text-stroke:1px_#9ffcff] [text-shadow:0_0_2px_#ffffff,0_0_6px_#8ffcff,0_0_12px_#2d7dff,0_0_22px_#0057ff,0_0_30px_#004cff] sm:text-[2rem] sm:[-webkit-text-stroke:1.2px_#9ffcff] lg:text-[2.35rem]">Chill Bros</div><div className="mt-1 truncate font-brand text-[0.48rem] font-semibold uppercase tracking-[0.2em] text-[#d9fbff] sm:text-[0.62rem] sm:tracking-[0.28em]">Operational Command Center</div></div><div className="hidden sm:flex sm:items-center sm:gap-2"><StatusPill>Internal operational app</StatusPill><StatusPill tone="emerald">Production</StatusPill></div><span className="shrink-0 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-emerald-200 sm:hidden">Live</span></div></div></div>
      <div className="mt-2 flex items-center justify-between gap-2 border-t border-[#2d7dff]/15 pt-2 text-xs sm:mt-3 sm:flex-wrap sm:border-0 sm:pt-0"><div className="hidden items-center gap-2 rounded-full border border-[#2d7dff]/25 bg-black/35 px-3 py-1.5 text-[#d9fbff] sm:inline-flex"><Snowflake className="h-3.5 w-3.5" />Supabase-backed operations</div><div className="flex min-w-0 flex-1 items-center justify-between gap-2 sm:flex-none sm:justify-end"><PageSyncControls />{profile ? <form action={signOutAction} className="min-w-0"><button type="submit" className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#2d7dff]/30 bg-[#2d7dff]/5 px-2 py-1 text-[10px] text-[#d9fbff] sm:text-xs"><LogOut className="h-3 w-3" /><span className="hidden sm:inline">{profile.fullName} · {roleLabel} · </span>Sign out</button></form> : null}</div></div>
      <nav className="mt-2 flex gap-1.5 overflow-x-auto pb-0.5 sm:mt-3 sm:gap-2 sm:pb-1">{visibleNavItems.map((item) => <Link key={item.href} href={item.href} className="whitespace-nowrap rounded-full border border-[#2d7dff]/30 bg-black/35 px-3 py-1.5 font-brand text-[10px] uppercase tracking-[0.12em] text-[#d9fbff] shadow-[0_0_8px_rgba(45,125,255,0.16)] transition hover:bg-[#2d7dff]/15 sm:px-4 sm:py-2 sm:text-sm"><span className="sm:hidden">{item.shortLabel}</span><span className="hidden sm:inline">{item.label}</span></Link>)}</nav>
    </header>
    <div className="mb-4 grid gap-4 lg:mb-6 lg:grid-cols-[1.35fr_0.65fr]"><section className="rounded-2xl border border-[#2d7dff]/35 bg-gradient-to-br from-[#2d7dff]/10 via-[#020407]/92 to-[#020407]/96 p-4 text-center shadow-[0_0_18px_rgba(45,125,255,0.18)] sm:rounded-3xl sm:p-5 sm:text-left lg:p-6"><p className="font-brand text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8ffafa] sm:text-xs sm:tracking-[0.3em]">Chill Bros operational command center</p><h1 className="neon-text mt-2 text-2xl font-semibold leading-[1.05] text-white sm:mt-3 sm:text-3xl lg:text-4xl">{title}</h1><p className="mx-auto mt-2 max-w-3xl text-sm leading-6 text-zinc-300 sm:mx-0 sm:mt-3 sm:text-base sm:leading-7">{description}</p></section><section className="hidden rounded-3xl border border-[#2d7dff]/35 bg-[#020407]/92 p-5 shadow-[0_0_18px_rgba(45,125,255,0.16)] lg:block">{highlight}</section></div>
    <main className="flex-1">{children}</main>
  </div></div>;
}
