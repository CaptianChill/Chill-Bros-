import type { ReactNode } from "react";
import Link from "next/link";
import { LogOut } from "lucide-react";

import { navItems, ownerNavItem } from "@/lib/chillbros/nav";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import { signOutAction } from "@/app/sign-in/actions";
import { AppNavigation } from "@/components/app-navigation";
import { AppSidebarNav } from "@/components/app-sidebar-nav";
import { FormDraftProtector } from "@/components/form-draft-protector";
import { LiveOfficeRefresh } from "@/components/live-office-refresh";
import { LogoBadge } from "@/components/logo-badge";
import { PageSyncControls } from "@/components/page-sync-controls";
import { PageTitle } from "@/components/page-title";

type AppShellProps = { children: ReactNode; title: string; description?: string; highlight?: ReactNode };

const OWNER_EMAIL = "chillprostx@gmail.com";

export async function AppShell({ children, description, highlight }: AppShellProps) {
  const profile = await getCurrentStaffProfile();
  const isOwner = profile?.role === "manager" && profile.email.trim().toLowerCase() === OWNER_EMAIL;
  const visibleNavItems = profile
    ? [...navItems.filter((item) => item.roles.includes(profile.role)), ...(isOwner ? [ownerNavItem] : [])]
    : [];
  const roleLabel = profile?.role === "manager" ? "Manager" : profile?.role === "office" ? "Office / Dispatch" : "Technician";

  const signOutButton = profile ? (
    <form action={signOutAction}>
      <button
        type="submit"
        title={`Sign out ${profile.fullName}`}
        className="box inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-black/35 px-3 py-2 text-center text-xs text-white transition"
      >
        <LogOut className="h-3.5 w-3.5" />
        <span>{profile.fullName} · {roleLabel}</span>
      </button>
    </form>
  ) : null;

  return (
    <div
      className="min-h-screen text-foreground"
      style={{
        backgroundImage: "url('/brand/chill-pros-camo-blue.webp')",
        backgroundRepeat: "repeat",
        backgroundSize: "460px auto",
        backgroundPosition: "top left",
      }}
    >
      {profile ? <LiveOfficeRefresh intervalMs={10000} /> : null}
      <a href="#main-content" className="box fixed left-3 top-3 z-[100] -translate-y-24 rounded-xl bg-[var(--saber)] px-4 py-2 text-center text-sm font-semibold text-black transition focus:translate-y-0">
        Skip to content
      </a>

      <div className="mx-auto flex min-h-screen w-full max-w-[1500px] lg:gap-6 lg:px-6 lg:py-6">
        {profile ? (
          <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-4 self-start overflow-y-auto py-6 pr-1 lg:flex">
            <Link href="/" className="flex items-center gap-2.5 px-1">
              <LogoBadge variant="icon" className="w-9 shrink-0" />
              <div className="min-w-0">
                <p className="truncate text-sm font-bold uppercase tracking-[0.04em] text-white">Chill Bros</p>
                <p className="truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Command Center</p>
              </div>
            </Link>
            <AppSidebarNav items={visibleNavItems} />
            <div className="border-t border-[var(--saber-soft)] pt-3">{signOutButton}</div>
          </aside>
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col px-3 pb-7 pt-2.5 sm:px-6 sm:pt-4 lg:px-0 lg:py-0">
          <header
            className="panel app-header sticky z-40 mb-2.5 rounded-2xl border border-[var(--saber-soft)] bg-[#020407] px-3 py-2.5 text-center sm:mb-3 sm:px-4 sm:py-3 lg:hidden"
            style={{ top: "max(env(safe-area-inset-top), 8px)" }}
          >
            <div className="flex items-center justify-center gap-2.5 sm:gap-4">
              <LogoBadge variant="full" className="w-9 shrink-0 sm:w-11" />
              <div className="min-w-0 flex-1 text-center">
                <div className="truncate font-serif text-[1.4rem] font-black italic uppercase leading-none tracking-[0.015em] text-[#071126] [-webkit-text-stroke:1px_#9ffcff] [text-shadow:0_0_2px_#ffffff,0_0_6px_#8ffcff,0_0_12px_#2d7dff,0_0_22px_#0057ff] sm:text-[1.8rem]">Chill Bros</div>
                <div className="sub mt-1 hidden truncate font-brand text-[0.58rem] font-semibold uppercase tracking-[0.2em] sm:block">Operational Command Center</div>
              </div>
              <div className="flex shrink-0 items-center justify-center gap-1.5">
                <PageSyncControls />
                {profile ? (
                  <form action={signOutAction}>
                    <button type="submit" title={`Sign out ${profile.fullName}`} className="box inline-flex min-h-10 items-center justify-center gap-1 rounded-xl bg-black/35 px-2.5 py-2 text-center text-[10px] text-white transition sm:text-xs">
                      <LogOut className="h-3.5 w-3.5" />
                      <span className="hidden md:inline">{profile.fullName} · {roleLabel}</span>
                      <span className="md:hidden">Exit</span>
                    </button>
                  </form>
                ) : null}
              </div>
            </div>
            <AppNavigation items={visibleNavItems} />
          </header>

          <div className="hidden items-start justify-between gap-4 border-b border-[var(--saber-soft)] pb-4 lg:flex">
            <div>
              <PageTitle />
              {description ? <p className="sub mt-1.5 text-sm">{description}</p> : null}
            </div>
          </div>

          <div className="relative z-10 mb-2.5 w-full px-1 py-1.5 text-center sm:mb-3 sm:px-2 lg:hidden">
            <PageTitle />
            {description ? <p className="sub mt-1.5 text-xs">{description}</p> : null}
          </div>

          {highlight ? <div className="mb-4">{highlight}</div> : null}

          <main id="main-content" className="relative z-20 isolate min-w-0 flex-1 text-center pointer-events-auto [&_a]:text-center [&_article]:text-center [&_button]:text-center [&_div]:text-center [&_input]:text-center [&_section]:text-center [&_select]:text-center [&_summary]:text-center [&_textarea]:text-center">
            {children}
          </main>
          {profile ? <FormDraftProtector profileId={profile.id} /> : null}
        </div>
      </div>
    </div>
  );
}
