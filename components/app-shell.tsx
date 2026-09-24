import type { ReactNode } from "react";

import { navItems, ownerNavItem, getPrimaryTabs } from "@/lib/chillbros/nav";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import { FormDraftProtector } from "@/components/form-draft-protector";
import { LiveOfficeRefresh } from "@/components/live-office-refresh";
import { StaffHeader, StaffSidebar, StaffTabBar, type StaffShellUser } from "@/components/staff-shell-nav";

type AppShellProps = {
  children: ReactNode;
  title: string;
  description?: string;
  highlight?: ReactNode;
  /** Shown first, above the highlight (e.g. the technician clock card). */
  lead?: ReactNode;
  /** Home only: how many items need attention (drives the bell's dot). */
  notificationCount?: number;
};

const OWNER_EMAIL = "chillprostx@gmail.com";
const TIME_ZONE = "America/Chicago";

function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] ?? "?").slice(0, 2);
  return letters.toUpperCase();
}

function greetingFor(now: Date) {
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, hour: "numeric", hourCycle: "h23" }).format(now));
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export async function AppShell({ children, title, description, highlight, lead, notificationCount = 0 }: AppShellProps) {
  const profile = await getCurrentStaffProfile();
  const isOwner = profile?.role === "manager" && profile.email.trim().toLowerCase() === OWNER_EMAIL;
  const visibleNavItems = profile
    ? [...navItems.filter((item) => item.roles.includes(profile.role)), ...(isOwner ? [ownerNavItem] : [])]
    : [];
  // Everything that isn't a primary tab stays reachable from "More".
  const primaryHrefs = new Set(profile ? getPrimaryTabs(profile.role).map((tab) => tab.href) : []);
  const moreItems = visibleNavItems.filter((item) => !primaryHrefs.has(item.href));

  const now = new Date();
  const user: StaffShellUser | null = profile
    ? {
        role: profile.role,
        fullName: profile.fullName,
        firstName: profile.fullName.trim().split(/\s+/)[0] || profile.fullName,
        initials: initialsFor(profile.fullName),
        roleLabel: profile.role === "manager" ? "Manager" : profile.role === "office" ? "Office / Dispatch" : "Technician",
      }
    : null;

  return (
    <div className="cb-staff cb-camo-page min-h-dvh">
      {profile ? <LiveOfficeRefresh intervalMs={10000} /> : null}
      <a href="#main-content" className="fixed left-3 top-3 z-[100] -translate-y-24 rounded-xl bg-[#1557B0] px-4 py-2 text-sm font-semibold text-white transition focus:translate-y-0">
        Skip to content
      </a>

      <div className="flex min-h-dvh w-full">
        {user ? <StaffSidebar user={user} moreItems={moreItems} /> : null}

        <div className="mx-auto flex w-full min-w-0 max-w-[1200px] flex-1 flex-col lg:px-6 lg:py-6">
          {user ? (
            <StaffHeader
              user={user}
              moreItems={moreItems}
              greeting={greetingFor(now)}
              dateLabel={new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, weekday: "long", month: "long", day: "numeric" }).format(now)}
              title={title}
              subtitle={description}
              notificationCount={notificationCount}
              notificationHref={profile?.role === "office" ? "/office" : "/#needs-attention"}
            />
          ) : null}

          <div className="cb-page flex-1 px-4 pb-[calc(96px+env(safe-area-inset-bottom))] pt-4 lg:px-0 lg:pb-8">
            {lead ? <div className="mb-3.5">{lead}</div> : null}
            {highlight ? <div className="mb-3.5">{highlight}</div> : null}
            <main id="main-content" className="relative isolate min-w-0">
              {children}
            </main>
          </div>
          {profile ? <FormDraftProtector profileId={profile.id} /> : null}
        </div>
      </div>

      {user ? <StaffTabBar role={user.role} /> : null}
    </div>
  );
}
