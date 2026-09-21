import type { StaffRole } from "./types";

export type NavItem = {
  href: string;
  label: string;
  shortLabel: string;
  roles: StaffRole[];
};

// Production navigation is intentionally small. The app still contains legacy,
// experimental, reporting, AI/3D, payroll, inventory, and admin routes, but they
// are not part of the day-to-day operating surface until the core service-call
// workflow is stable end to end.
export const navItems: NavItem[] = [
  { href: "/", label: "Home", shortLabel: "Home", roles: ["manager"] },
  { href: "/office", label: "Office", shortLabel: "Office", roles: ["office"] },
  { href: "/schedule", label: "Schedule", shortLabel: "Schedule", roles: ["manager", "office"] },
  { href: "/dispatch", label: "Dispatch", shortLabel: "Dispatch", roles: ["manager", "office"] },
  { href: "/customers", label: "Customers", shortLabel: "Customers", roles: ["manager", "office"] },
  { href: "/revenue-radar", label: "Revenue Radar", shortLabel: "Radar", roles: ["manager", "office"] },
  { href: "/revenue-radar/tasks", label: "Sales Tasks", shortLabel: "Sales", roles: ["office"] },
  { href: "/revenue-radar/handoffs", label: "Tech Requests", shortLabel: "Requests", roles: ["technician"] },
  { href: "/technician", label: "Field Jobs", shortLabel: "Field", roles: ["manager", "technician"] },
  { href: "/invoices", label: "Quotes & Invoices", shortLabel: "Billing", roles: ["manager", "office"] },
  { href: "/timesheet", label: "Clock", shortLabel: "Clock", roles: ["manager", "technician"] },
  { href: "/parts-lookup", label: "Parts Lookup", shortLabel: "Parts", roles: ["manager", "technician", "office"] },
];

// Manager-only tools that don't belong in the daily tab bar (sales pipeline
// audit, DNC review, payment settings, manual payment recording, etc.) live
// under Owner Access (app/owner/page.tsx) instead of as separate nav items.
