import type { StaffRole } from "./types";

export type NavItem = {
  href: string;
  label: string;
  shortLabel: string;
  roles: StaffRole[];
};

export const navItems: NavItem[] = [
  { href: "/", label: "Command Center", shortLabel: "Home", roles: ["manager"] },
  { href: "/office", label: "Office Hub", shortLabel: "Office", roles: ["manager", "office"] },
  { href: "/dispatch", label: "Dispatch", shortLabel: "Dispatch", roles: ["manager", "office"] },
  { href: "/agreements", label: "Monthly Plans", shortLabel: "Plans", roles: ["manager", "office"] },
  { href: "/manager", label: "Manager Hub", shortLabel: "Manager", roles: ["manager"] },
  { href: "/security", label: "Security", shortLabel: "Secure", roles: ["manager"] },
  { href: "/technician", label: "Tech Workflow", shortLabel: "Tech", roles: ["technician"] },
  { href: "/training", label: "Training · Bible", shortLabel: "Bible", roles: ["manager", "technician", "office"] },
  { href: "/timesheet", label: "Timesheets", shortLabel: "Time", roles: ["manager", "technician", "office"] },
  { href: "/inventory", label: "Inventory", shortLabel: "Parts", roles: ["manager"] },
  { href: "/equipment", label: "Equipment", shortLabel: "Assets", roles: ["manager", "office"] },
  { href: "/3d-studio", label: "3D Studio", shortLabel: "3D", roles: ["manager"] },
  { href: "/crm", label: "Customer CRM", shortLabel: "CRM", roles: ["manager", "office"] },
  { href: "/reports", label: "Reports", shortLabel: "Reports", roles: ["manager"] },
];
