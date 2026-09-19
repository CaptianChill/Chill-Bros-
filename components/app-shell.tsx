import type { ReactNode } from "react";
import { LogOut } from "lucide-react";

import { navItems, type NavItem } from "@/lib/chillbros/nav";
import { getCurrentStaffProfile } from "@/lib/neon/data-api/auth-server";
import { signOutAction } from "@/app/sign-in/actions";
import { AppNavigation } from "@/components/app-navigation";
import { FormDraftProtector } from "@/components/form-draft-protector";
import { LiveOfficeRefresh } from "@/components/live-office-refresh";
import { LogoBadge } from "@/components/logo-badge";
import { PageSyncControls } from "@/components/page-sync-controls";
import { PageTitle } from "@/components/page-title";

type AppShellProps = { children: ReactNode; title: string; description?: string; highlight?: ReactNode };

const OWNER_EMAIL = "chillprostx@gmail.com";
const ownerNavItem: NavItem = { href: "/owner", label: "Owner Access", shortLabel: "Owner", roles: ["manager"] };

export async function AppShell({ children }: AppShellProps) {
  const profile = await getCurrentStaffProfile();
  const isOwner = profile?.role === "manager" && profile.email.trim().toLowerCase() === OWNER_EMAIL;
  const visibleNavItems = profile
    ? [...navItems.filter((item) => item.roles.includes(profile.role)), ...(isOwner ? [ownerNavItem] : [])]
    : [];
  const roleLabel = profile?.role === "manager" ? "Manager" : profile?.role === "office" ? "Office / Dispatch" : "Technician";

  return <div className="min-h-screen bg-transparent text-foreground">
    {profile ? <LiveOfficeRefresh intervalMs={10000} /> : null}
    <a href="#main-content" className="box fixed left-3 top-3 z-[100] -translate-y-24 rounded-xl bg-[var(--saber)] px-4 py-2 text-center text-sm font-semibold text-black transition focus:translate-y-0">Skip to content</a>
    <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-3 pb-7 pt-2.5 sm:px-6 sm:pt-4 lg:px-8">
      <header
        className="panel app-header sticky z-40 mb-2.5 rounded-2xl border border-[var(--saber-soft)] bg-[#020407] px-3 py-2.5 text-center sm:mb-3 sm:px-4 sm:py-3"
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
            {profile ? <form action={signOutAction}><button type="submit" title={`Sign out ${profile.fullName}`} className="box inline-flex min-h-10 items-center justify-center gap-1 rounded-xl bg-black/35 px-2.5 py-2 text-center text-[10px] text-white transition sm:text-xs"><LogOut className="h-3.5 w-3.5" /><span className="hidden md:inline">{profile.fullName} · {roleLabel}</span><span className="md:hidden">Exit</span></button></form> : null}
          </div>
        </div>
        <AppNavigation items={visibleNavItems} />
      </header>

      <div className="relative z-10 mb-2.5 w-full px-1 py-1.5 text-center sm:mb-3 sm:px-2">
        <PageTitle />
      </div>

      <main id="main-content" className="relative z-20 isolate min-w-0 flex-1 text-center pointer-events-auto [&_a]:text-center [&_article]:text-center [&_button]:text-center [&_div]:text-center [&_input]:text-center [&_section]:text-center [&_select]:text-center [&_summary]:text-center [&_textarea]:text-center">{children}</main>
      {profile ? <FormDraftProtector profileId={profile.id} /> : null}
    </div>
  </div>;
}
