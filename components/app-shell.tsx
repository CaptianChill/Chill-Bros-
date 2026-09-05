import type { ReactNode } from "react";
import { LogOut } from "lucide-react";

import { navItems } from "@/lib/chillbros/nav";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import { signOutAction } from "@/app/sign-in/actions";
import { AppNavigation } from "@/components/app-navigation";
import { LogoBadge } from "@/components/logo-badge";
import { PageSyncControls } from "@/components/page-sync-controls";
import { PageTitle } from "@/components/page-title";

type AppShellProps = { children: ReactNode; title: string; description?: string; highlight?: ReactNode };

export async function AppShell({ children }: AppShellProps) {
  const profile = await getCurrentStaffProfile();
  const visibleNavItems = profile ? navItems.filter((item) => item.roles.includes(profile.role)) : [];
  const roleLabel = profile?.role === "manager" ? "Manager" : profile?.role === "office" ? "Office / Dispatch" : "Technician";

  return <div className="min-h-screen bg-transparent text-foreground">
    <a href="#main-content" className="fixed left-3 top-3 z-[100] -translate-y-24 rounded-xl bg-[#8ffafa] px-4 py-2 text-sm font-semibold text-black transition focus:translate-y-0">Skip to content</a>
    <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-3 pb-8 pt-2.5 sm:px-6 sm:pt-4 lg:px-8">
      <header className="sticky z-40 mb-3 rounded-2xl border border-[#2d7dff]/40 bg-[#020407]/98 px-3 py-2.5 shadow-[0_0_16px_rgba(45,125,255,0.30)] backdrop-blur-xl sm:mb-4 sm:px-4 sm:py-3" style={{ top: "max(env(safe-area-inset-top), 8px)", WebkitTransform: "translateZ(0)" }}>
        <div className="flex items-center gap-2.5 sm:gap-4">
          <LogoBadge variant="full" className="w-9 shrink-0 sm:w-11" />
          <div className="min-w-0 flex-1">
            <div className="truncate font-serif text-[1.45rem] font-black italic uppercase leading-none tracking-[0.015em] text-[#071126] [-webkit-text-stroke:1px_#9ffcff] [text-shadow:0_0_2px_#ffffff,0_0_6px_#8ffcff,0_0_12px_#2d7dff,0_0_22px_#0057ff] sm:text-[1.8rem]">Chill Bros</div>
            <div className="mt-1 truncate font-brand text-[0.46rem] font-semibold uppercase tracking-[0.2em] text-[#d9fbff] sm:text-[0.58rem]">Operational Command Center</div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <PageSyncControls />
            {profile ? <form action={signOutAction}><button type="submit" title={`Sign out ${profile.fullName}`} className="inline-flex items-center gap-1 rounded-xl border border-[#2d7dff]/25 bg-black/35 px-2.5 py-2 text-[10px] text-[#d9fbff] transition hover:bg-[#2d7dff]/15 sm:text-xs"><LogOut className="h-3.5 w-3.5" /><span className="hidden md:inline">{profile.fullName} · {roleLabel}</span><span className="md:hidden">Exit</span></button></form> : null}
          </div>
        </div>
        <AppNavigation items={visibleNavItems} />
      </header>

      <div className="mb-3 flex min-h-14 items-center justify-center rounded-2xl border border-[#2d7dff]/25 bg-[#020407]/78 px-4 py-3 shadow-[0_0_14px_rgba(45,125,255,0.12)] sm:mb-4 sm:px-5">
        <PageTitle />
      </div>

      <main id="main-content" className="min-w-0 flex-1">{children}</main>
    </div>
  </div>;
}
