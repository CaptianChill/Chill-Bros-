import type { StaffRole } from "./types";

export type NavItem = {
  href: string;
  label: string;
  shortLabel: string;
  roles: StaffRole[];
};

export const navItems: NavItem[] = [
  { href: "/", label: "Command Center", shortLabel: "Home", roles: ["manager"] },
  { href: "/create", label: "Creation Center", shortLabel: "Create", roles: ["manager"] },
  { href: "/office", label: "Office Hub", shortLabel: "Office", roles: ["manager", "office"] },
  { href: "/dispatch", label: "Dispatch", shortLabel: "Dispatch", roles: ["manager", "office"] },
  { href: "/customers", label: "Customer Center", shortLabel: "Customers", roles: ["manager", "office"] },
  { href: "/scan-send", label: "Scan & Send", shortLabel: "Scan", roles: ["manager", "technician", "office"] },
  { href: "/invoices/new", label: "Invoice", shortLabel: "Invoice", roles: ["manager"] },
  { href: "/invoices", label: "Invoices", shortLabel: "Invoices", roles: ["office"] },
  { href: "/payments", label: "Payment Center", shortLabel: "Payments", roles: ["manager"] },
  { href: "/settings/payments", label: "Payments & Payouts", shortLabel: "Pay Setup", roles: ["manager"] },
  { href: "/timesheet", label: "Timesheets", shortLabel: "Time", roles: ["manager", "technician", "office"] },
  { href: "/technician", label: "Field Workflow", shortLabel: "Field", roles: ["manager", "technician"] },
  { href: "/equipment", label: "Equipment", shortLabel: "Assets", roles: ["manager", "office"] },
  { href: "/training", label: "Training · Bible", shortLabel: "Bible", roles: ["manager", "technician", "office"] },
  { href: "/agreements", label: "Monthly Plans", shortLabel: "Plans", roles: ["manager", "office"] },
  { href: "/inventory", label: "Inventory", shortLabel: "Parts", roles: ["manager"] },
  { href: "/reports", label: "Reports", shortLabel: "Reports", roles: ["manager"] },
  { href: "/manager", label: "Manager Hub", shortLabel: "Manager", roles: ["manager"] },
  { href: "/security", label: "Security", shortLabel: "Secure", roles: ["manager"] },
  { href: "/3d-studio", label: "3D Studio", shortLabel: "3D", roles: ["manager"] },
];
