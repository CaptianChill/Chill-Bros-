import {
  Banknote,
  CalendarDays,
  ClipboardList,
  Clock3,
  CreditCard,
  FileSignature,
  GraduationCap,
  Home,
  Radar,
  Sparkles,
  StickyNote,
  UsersRound,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import type { StaffRole } from "./types";

export type NavGroup = "command" | "crm" | "operations" | "sales" | "financial";

export type NavItem = {
  href: string;
  label: string;
  shortLabel: string;
  roles: StaffRole[];
  group: NavGroup;
};

export const GROUP_ORDER: NavGroup[] = ["command", "crm", "operations", "sales", "financial"];

export const GROUP_LABELS: Record<NavGroup, string> = {
  command: "Command Center",
  crm: "CRM",
  operations: "Operations",
  sales: "Sales",
  financial: "Financial",
};

// Production navigation is intentionally small: every role gets the same simple
// flow (Work -> Schedule -> Billing) and a short More list. Pages that were merged
// in the menu (Dispatch + Calendar, Invoices + Payments, Leads + Plans + Tasks)
// stay separate pages and are switched with SECTION_TABS at the top of the page.
// Tech Assist opens from each job on the tech's job screen, not the menu.
export const navItems: NavItem[] = [
  { href: "/", label: "Home", shortLabel: "Home", roles: ["manager"], group: "command" },
  { href: "/office", label: "Home", shortLabel: "Home", roles: ["office"], group: "command" },
  { href: "/work", label: "Work", shortLabel: "Work", roles: ["manager", "office"], group: "command" },
  { href: "/dispatch", label: "Schedule", shortLabel: "Schedule", roles: ["manager", "office"], group: "command" },
  { href: "/invoices", label: "Billing", shortLabel: "Billing", roles: ["manager", "office"], group: "financial" },
  { href: "/customers", label: "Customers", shortLabel: "Customers", roles: ["manager", "office"], group: "crm" },
  { href: "/revenue-radar", label: "Sales", shortLabel: "Sales", roles: ["manager", "office"], group: "sales" },
  { href: "/technician", label: "My Jobs", shortLabel: "My Jobs", roles: ["technician"], group: "operations" },
  { href: "/field-notes", label: "Notes", shortLabel: "Notes", roles: ["technician"], group: "operations" },
  { href: "/timesheet", label: "Clock", shortLabel: "Clock", roles: ["technician"], group: "operations" },
  { href: "/parts-lookup", label: "Parts Pro", shortLabel: "Parts Pro", roles: ["manager", "technician", "office"], group: "operations" },
  { href: "/training", label: "Training", shortLabel: "Training", roles: ["technician"], group: "operations" },
  { href: "/revenue-radar/handoffs", label: "Send a Lead", shortLabel: "Lead", roles: ["technician"], group: "sales" },
];

// Switch tabs shown at the top of pages that share one menu entry.
export type SectionTab = { href: string; label: string; roles: StaffRole[] };
export const SECTION_TABS: SectionTab[][] = [
  [
    { href: "/dispatch", label: "Board", roles: ["manager", "office"] },
    { href: "/schedule", label: "Calendar", roles: ["manager", "office"] },
  ],
  [
    { href: "/invoices", label: "Quotes & Invoices", roles: ["manager", "office"] },
    { href: "/payments", label: "Payments", roles: ["manager", "office"] },
  ],
  [
    { href: "/revenue-radar", label: "Leads", roles: ["manager", "office"] },
    { href: "/agreements", label: "Service Plans", roles: ["manager", "office"] },
    { href: "/revenue-radar/tasks", label: "Sales Tasks", roles: ["manager", "office"] },
  ],
];

// Finds the section a page belongs to and which tab is current (longest matching path wins,
// so /revenue-radar/tasks is "Sales Tasks", not "Leads"). Tech-only Send a Lead is not part of Sales.
export function sectionTabsFor(pathname: string, role: StaffRole) {
  if (pathname.startsWith("/revenue-radar/handoffs")) return null;
  for (const group of SECTION_TABS) {
    const tabs = group.filter((tab) => tab.roles.includes(role));
    const matches = tabs.filter((tab) => pathname === tab.href || pathname.startsWith(`${tab.href}/`));
    if (!matches.length || tabs.length < 2) continue;
    const active = matches.sort((a, b) => b.href.length - a.href.length)[0];
    return { tabs, activeHref: active.href };
  }
  return null;
}

// Manager-only tools that don't belong in the daily nav (sales pipeline
// audit, DNC review, payment settings, manual payment recording, etc.) live
// under Owner Access (app/owner/page.tsx) instead of as separate nav items.
export const ownerNavItem: NavItem = { href: "/owner", label: "Owner Access", shortLabel: "Owner", roles: ["manager"], group: "command" };

export const NAV_ICONS: Partial<Record<string, LucideIcon>> = {
  "/": Home,
  "/office": Home,
  "/work": ClipboardList,
  "/schedule": CalendarDays,
  "/dispatch": CalendarDays,
  "/customers": UsersRound,
  "/technician": Wrench,
  "/field-notes": StickyNote,
  "/timesheet": Clock3,
  "/parts-lookup": Wrench,
  "/tech-assist": Sparkles,
  "/training": GraduationCap,
  "/agreements": FileSignature,
  "/revenue-radar": Radar,
  "/revenue-radar/tasks": Radar,
  "/revenue-radar/handoffs": Radar,
  "/invoices": Banknote,
  "/payments": CreditCard,
};

const isUnder = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

export function isNavItemActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/technician") return pathname === "/technician" || pathname.startsWith("/jobs/");
  if (href === "/invoices") return isUnder(pathname, "/invoices") || isUnder(pathname, "/payments");
  if (href === "/dispatch") return isUnder(pathname, "/dispatch") || isUnder(pathname, "/schedule");
  if (href === "/revenue-radar") return (isUnder(pathname, "/revenue-radar") && !isUnder(pathname, "/revenue-radar/handoffs")) || isUnder(pathname, "/agreements");
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function groupNavItems(items: NavItem[]) {
  return GROUP_ORDER.map((group) => ({ group, label: GROUP_LABELS[group], items: items.filter((item) => item.group === group) })).filter(
    (entry) => entry.items.length > 0,
  );
}

// Phone tab bar / desktop sidebar primary items. Everything else in the
// role's nav stays reachable from the "More" menu.
export type PrimaryTab = { href: string; label: string; icon: LucideIcon; isActive: (pathname: string) => boolean };

export function getPrimaryTabs(role: StaffRole): PrimaryTab[] {
  if (role === "technician") {
    // Technicians can't open Dispatch or Billing, and "/" redirects them to
    // their field workflow, so they get their own daily screens instead.
    return [
      { href: "/technician", label: "My Jobs", icon: Wrench, isActive: (p) => p === "/" || p === "/technician" || p.startsWith("/jobs/") || p.startsWith("/tech-assist") },
      { href: "/field-notes", label: "Notes", icon: StickyNote, isActive: (p) => isUnder(p, "/field-notes") },
      { href: "/timesheet", label: "Clock", icon: Clock3, isActive: (p) => isUnder(p, "/timesheet") },
    ];
  }

  const homeHref = role === "office" ? "/office" : "/";

  return [
    { href: homeHref, label: "Home", icon: Home, isActive: (p) => p === "/" || p === "/office" },
    // Open work: saved calls, quotes and invoices still to finish.
    { href: "/work", label: "Work", icon: ClipboardList, isActive: (p) => isUnder(p, "/work") || p.startsWith("/jobs/") },
    { href: "/dispatch", label: "Schedule", icon: CalendarDays, isActive: (p) => isUnder(p, "/dispatch") || isUnder(p, "/schedule") },
    { href: "/invoices", label: "Billing", icon: Banknote, isActive: (p) => isUnder(p, "/invoices") || isUnder(p, "/payments") },
  ];
}

export function getHomeHref(role: StaffRole) {
  return role === "office" ? "/office" : role === "technician" ? "/technician" : "/";
}
