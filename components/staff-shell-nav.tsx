"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Bell, ChevronLeft, Ellipsis, LogOut, RefreshCw, Save, Wrench, X } from "lucide-react";

import { signOutAction } from "@/app/sign-in/actions";
import { titleForPath } from "@/components/page-title";
import { getHomeHref, getPrimaryTabs, groupNavItems, isNavItemActive, NAV_ICONS, type NavItem } from "@/lib/chillbros/nav";
import type { StaffRole } from "@/lib/chillbros/types";

const WORDMARK = { src: "/brand/chill-pros-wordmark-chrome-600.webp", width: 600, height: 185 };
const SAVE_ENABLED_PATHS = ["/technician", "/dispatch", "/manager"];

const roundNavButton =
  "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#2A4468] bg-[#13284A] text-white transition hover:bg-[#1557B0]";

export type StaffShellUser = {
  role: StaffRole;
  fullName: string;
  firstName: string;
  initials: string;
  roleLabel: string;
};

function useIsHome(role: StaffRole) {
  const pathname = usePathname();
  return pathname === getHomeHref(role) || (role !== "technician" && pathname === "/");
}

export function StaffHeader({
  user,
  moreItems,
  greeting,
  dateLabel,
  title,
  subtitle,
  notificationCount,
  notificationHref,
}: {
  user: StaffShellUser;
  moreItems: NavItem[];
  greeting: string;
  dateLabel: string;
  title: string;
  subtitle?: string;
  notificationCount: number;
  notificationHref: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const isHome = useIsHome(user.role);
  const [menuOpen, setMenuOpen] = useState(false);
  const screenTitle = titleForPath(pathname) ?? title;

  const goBack = () => {
    if (window.history.length > 1) router.back();
    else router.push(getHomeHref(user.role));
  };

  return (
    <>
      <header className="cb-camo-band cb-glass-text px-4 pb-4 pt-3 lg:rounded-xl lg:px-5">
        {isHome ? (
          <>
            <Image src={WORDMARK.src} width={WORDMARK.width} height={WORDMARK.height} alt="Chill Pros" priority className="h-auto w-full lg:hidden" />
            <div className="mt-3 flex items-center justify-between gap-3 lg:mt-0">
              <div className="min-w-0">
                <p className="cb-display truncate text-[26px] leading-tight">
                  {greeting}, {user.firstName}
                </p>
                <p className="mt-0.5 text-sm font-medium">{dateLabel}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Link href={notificationHref} aria-label={notificationCount > 0 ? `${notificationCount} items need attention` : "Notifications"} className={`${roundNavButton} relative`}>
                  <Bell className="h-5 w-5" aria-hidden="true" />
                  {notificationCount > 0 ? <span className="absolute right-2.5 top-2.5 h-2.5 w-2.5 rounded-full bg-[#38B6FF] ring-2 ring-[#13284A]" aria-hidden="true" /> : null}
                </Link>
                <button
                  type="button"
                  onClick={() => setMenuOpen(true)}
                  aria-label={`Account and more pages for ${user.fullName}`}
                  aria-haspopup="dialog"
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#1557B0]/40 bg-[#9FD3FF] text-sm font-bold text-[#0A1A33] [text-shadow:none]"
                >
                  {user.initials}
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-[44px_1fr_44px] items-center gap-2">
              <button type="button" onClick={goBack} aria-label="Go back" className={roundNavButton}>
                <ChevronLeft className="h-6 w-6" aria-hidden="true" />
              </button>
              <div className="flex justify-center">
                <Image src={WORDMARK.src} width={WORDMARK.width} height={WORDMARK.height} alt="Chill Pros" priority className="h-auto max-h-[84px] w-full max-w-[270px] object-contain lg:hidden" />
              </div>
              <button type="button" onClick={() => setMenuOpen(true)} aria-label="More pages and account" aria-haspopup="dialog" className={`${roundNavButton} lg:invisible`}>
                <Ellipsis className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <h1 className="mt-2 text-center text-[40px] leading-tight lg:mt-0">{screenTitle}</h1>
            {subtitle ? <p className="mt-0.5 truncate text-center text-sm font-medium text-[#13284A]">{subtitle}</p> : null}
          </>
        )}
      </header>
      {menuOpen ? <MoreSheet user={user} items={moreItems} onClose={() => setMenuOpen(false)} /> : null}
    </>
  );
}

function MoreSheet({ user, items, onClose }: { user: StaffShellUser; items: NavItem[]; onClose: () => void }) {
  const pathname = usePathname();
  const [refreshing, setRefreshing] = useState(false);
  const [saveSent, setSaveSent] = useState(false);
  const canSave = SAVE_ENABLED_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const save = () => {
    window.dispatchEvent(new CustomEvent("chillbros-save"));
    setSaveSent(true);
    window.setTimeout(() => setSaveSent(false), 1400);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-[#0A1A33]/60 sm:items-center" role="dialog" aria-modal="true" aria-label="More" onClick={onClose}>
      <div
        className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-4 text-[#0A1A33] sm:rounded-2xl"
        style={{ paddingBottom: "calc(16px + env(safe-area-inset-bottom))" }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#9FD3FF] text-sm font-bold">{user.initials}</span>
            <div className="min-w-0">
              <p className="truncate font-semibold">{user.fullName}</p>
              <p className="truncate text-sm text-[#2B3F5C]">{user.roleLabel}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close menu" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#DCE4EE]">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2.5">
          {canSave ? (
            <button type="button" onClick={save} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#C7D3E2] px-3 text-sm font-semibold">
              <Save className="h-4 w-4" aria-hidden="true" />
              {saveSent ? "Save sent" : "Save page"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              setRefreshing(true);
              window.location.reload();
            }}
            disabled={refreshing}
            className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#C7D3E2] px-3 text-sm font-semibold disabled:opacity-60 ${canSave ? "" : "col-span-2"}`}
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} aria-hidden="true" />
            {refreshing ? "Refreshing" : "Refresh"}
          </button>
        </div>

        <MoreLinks items={items} onNavigate={onClose} tone="light" />

        <form action={signOutAction} className="mt-4 border-t border-[#EEF2F7] pt-4">
          <button type="submit" className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#C7D3E2] px-3 text-sm font-semibold">
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}

/** Every page that isn't one of the four primary tabs, grouped as before. */
export function MoreLinks({ items, onNavigate, tone }: { items: NavItem[]; onNavigate?: () => void; tone: "light" | "dark" }) {
  const pathname = usePathname();
  if (!items.length) return null;

  const heading = tone === "light" ? "text-[#2B3F5C]" : "text-white/80";
  const idle = tone === "light" ? "text-[#0A1A33] hover:bg-[#EEF2F7]" : "text-white hover:bg-white/10";
  const active = tone === "light" ? "bg-[#DDEEFF] text-[#0E3F82]" : "bg-white/15 text-white";

  return (
    <nav aria-label="More pages" className="mt-4 space-y-4">
      <p className={`cb-display text-lg ${tone === "light" ? "text-[#0A1A33]" : "text-white"}`}>More</p>
      {groupNavItems(items).map((group) => (
        <div key={group.group}>
          <p className={`pb-1 text-xs font-semibold uppercase tracking-[0.08em] ${heading}`}>{group.label}</p>
          <div className="space-y-0.5">
            {group.items.map((item) => {
              const Icon = NAV_ICONS[item.href] ?? Wrench;
              const isActive = isNavItemActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition ${isActive ? active : idle}`}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

function PrimaryTabLinks({ role, layout }: { role: StaffRole; layout: "bar" | "sidebar" }) {
  const pathname = usePathname();
  const tabs = getPrimaryTabs(role);

  return tabs.map((tab) => {
    const active = tab.isActive(pathname);
    const Icon = tab.icon;
    const shape =
      layout === "bar"
        ? "min-h-[56px] flex-col justify-center gap-1 px-1 text-xs"
        : "min-h-11 gap-3 px-3 text-sm";
    const tone = active
      ? "border-[#1557B0] bg-[#9FD3FF] text-[#0A1A33] shadow-[0_4px_12px_rgba(10,26,51,0.25)]"
      : "border-white/80 bg-white/60 text-[#0A1A33] hover:bg-white/85";

    return (
      <Link key={tab.href} href={tab.href} aria-current={active ? "page" : undefined} className={`cb-tab flex items-center rounded-xl border font-semibold ${shape} ${tone}`}>
        <Icon className={layout === "bar" ? "h-5 w-5" : "h-4 w-4 shrink-0"} aria-hidden="true" />
        <span className="truncate">{tab.label}</span>
      </Link>
    );
  });
}

export function StaffTabBar({ role }: { role: StaffRole }) {
  const count = getPrimaryTabs(role).length;
  return (
    <nav
      aria-label="Primary"
      className="cb-camo-band fixed inset-x-0 bottom-0 z-50 px-3 pt-2 lg:hidden"
      style={{ paddingBottom: "calc(8px + env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto grid max-w-xl gap-1.5" style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}>
        <PrimaryTabLinks role={role} layout="bar" />
      </div>
    </nav>
  );
}

export function StaffSidebar({ user, moreItems }: { user: StaffShellUser; moreItems: NavItem[] }) {
  return (
    <aside className="cb-camo-band sticky top-0 hidden h-dvh w-64 shrink-0 flex-col overflow-y-auto px-4 py-5 lg:flex">
      <Link href={getHomeHref(user.role)} aria-label="Chill Pros home" className="block">
        <Image src={WORDMARK.src} width={WORDMARK.width} height={WORDMARK.height} alt="Chill Pros" className="h-auto w-full" />
      </Link>
      <nav aria-label="Primary" className="mt-5 grid gap-1.5">
        <PrimaryTabLinks role={user.role} layout="sidebar" />
      </nav>
      <div className="flex-1">
        <MoreLinks items={moreItems} tone="light" />
      </div>
      <form action={signOutAction} className="mt-4 border-t border-[#0A1A33]/10 pt-4">
        <button
          type="submit"
          className="inline-flex min-h-11 w-full items-center gap-3 rounded-xl border border-[#2A4468] bg-[#13284A] px-3 text-left text-sm font-medium text-white hover:bg-[#1557B0]"
        >
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#9FD3FF] text-[11px] font-bold text-[#0A1A33]">{user.initials}</span>
          <span className="min-w-0 flex-1 truncate">Sign out {user.firstName}</span>
          <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
        </button>
      </form>
    </aside>
  );
}
