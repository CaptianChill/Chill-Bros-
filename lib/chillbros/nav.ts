import {
  Banknote,
  CalendarDays,
  ClipboardList,
  Clock3,
  CreditCard,
  Home,
  Radar,
  Route,
  Search,
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

// Production navigation is intentionally small. The app still contains legacy,
// experimental, reporting, AI/3D, payroll, inventory, and admin routes, but they
// are not part of the day-to-day operating surface until the core service-call
// workflow is stable end to end.
export const navItems: NavItem[] = [
  { href: "/", label: "Home", shortLabel: "Home", roles: ["manager"], group: "command" },
  { href: "/office", label: "Office", shortLabel: "Office", roles: ["office"], group: "command" },
  { href: "/work", label: "Open Work", shortLabel: "Work", roles: ["manager", "office"], group: "command" },
  { href: "/schedule", label: "Schedule", shortLabel: "Schedule", roles: ["manager", "office"], group: "command" },
  { href: "/dispatch", label: "Dispatch", shortLabel: "Dispatch", roles: ["manager", "office"], group: "command" },
  { href: "/customers", label: "Customers", shortLabel: "Customers", roles: ["manager", "office"], group: "crm" },
  { href: "/technician", label: "Field Jobs", shortLabel: "Field", roles: ["manager", "technician"], group: "operations" },
  { href: "/field-notes", label: "Field Notes", shortLabel: "Notes", roles: ["manager", "technician"], group: "operations" },
  { href: "/timesheet", label: "Clock", shortLabel: "Clock", roles: ["manager", "technician"], group: "operations" },
  { href: "/parts-lookup", label: "Parts Pro", shortLabel: "Parts Pro", roles: ["manager", "technician", "office"], group: "operations" },
  { href: "/revenue-radar", label: "Revenue Radar", shortLabel: "Radar", roles: ["manager", "office"], group: "sales" },
  { href: "/revenue-radar/tasks", label: "Sales Tasks", shortLabel: "Sales", roles: ["office"], group: "sales" },
  { href: "/revenue-radar/handoffs", label: "Tech Requests", shortLabel: "Requests", roles: ["technician"], group: "sales" },
  { href: "/invoices", label: "Quotes & Invoices", shortLabel: "Billing", roles: ["manager", "office"], group: "financial" },
  { href: "/payments", label: "Payments", shortLabel: "Payments", roles: ["manager", "office"], group: "financial" },
];

// Manager-only tools that don't belong in the daily nav (sales pipeline
// audit, DNC review, payment settings, manual payment recording, etc.) live
// under Owner Access (app/owner/page.tsx) instead of as separate nav items.
export const ownerNavItem: NavItem = { href: "/owner", label: "Owner Access", shortLabel: "Owner", roles: ["manager"], group: "command" };

export const NAV_ICONS: Partial<Record<string, LucideIcon>> = {
  "/": Home,
  "/office": Home,
  "/work": ClipboardList,
  "/schedule": CalendarDays,
  "/dispatch": Route,
  "/customers": UsersRound,
  "/technician": Wrench,
  "/field-notes": StickyNote,
  "/timesheet": Clock3,
  "/parts-lookup": Wrench,
  "/revenue-radar": Radar,
  "/revenue-radar/tasks": Radar,
  "/revenue-radar/handoffs": Radar,
  "/invoices": Banknote,
  "/payments": CreditCard,
};

export function isNavItemActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/technician") return pathname === "/technician" || pathname.startsWith("/jobs/");
  if (href === "/invoices") return pathname === "/invoices" || pathname.startsWith("/invoices/");
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

const isUnder = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

export function getPrimaryTabs(role: StaffRole): PrimaryTab[] {
  if (role === "technician") {
    // Technicians can't open Dispatch or Billing, and "/" redirects them to
    // their field workflow, so they get their own daily screens instead.
    return [
      { href: "/technician", label: "Job", icon: Wrench, isActive: (p) => p === "/" || p === "/technician" || p.startsWith("/jobs/") },
      { href: "/field-notes", label: "Notes", icon: StickyNote, isActive: (p) => isUnder(p, "/field-notes") },
      { href: "/timesheet", label: "Clock", icon: Clock3, isActive: (p) => isUnder(p, "/timesheet") },
      { href: "/parts-lookup", label: "Parts Pro", icon: Search, isActive: (p) => isUnder(p, "/parts-lookup") },
    ];
  }

  const homeHref = role === "office" ? "/office" : "/";

  return [
    { href: homeHref, label: "Home", icon: Home, isActive: (p) => p === "/" || p === "/office" },
    // Open work: saved calls, quotes and invoices still to finish.
    { href: "/work", label: "Work", icon: ClipboardList, isActive: (p) => isUnder(p, "/work") || p.startsWith("/jobs/") },
    { href: "/dispatch", label: "Dispatch", icon: Route, isActive: (p) => isUnder(p, "/dispatch") },
    { href: "/invoices", label: "Billing", icon: Banknote, isActive: (p) => isUnder(p, "/invoices") },
  ];
}

export function getHomeHref(role: StaffRole) {
  return role === "office" ? "/office" : role === "technician" ? "/technician" : "/";
}
