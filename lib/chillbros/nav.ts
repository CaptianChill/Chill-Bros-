export type NavItem = {
  href: string;
  label: string;
  shortLabel: string;
  managerOnly?: boolean;
};

export const navItems: NavItem[] = [
  { href: "/", label: "Command Center", shortLabel: "Home" },
  { href: "/dispatch", label: "Dispatch", shortLabel: "Dispatch", managerOnly: true },
  { href: "/manager", label: "Manager Hub", shortLabel: "Manager", managerOnly: true },
  { href: "/technician", label: "Tech Workflow", shortLabel: "Tech" },
  { href: "/timesheet", label: "Timesheets", shortLabel: "Time" },
  { href: "/inventory", label: "Inventory", shortLabel: "Parts", managerOnly: true },
  { href: "/equipment", label: "Equipment", shortLabel: "Assets", managerOnly: true },
  { href: "/crm", label: "Customer CRM", shortLabel: "CRM", managerOnly: true },
  { href: "/reports", label: "Reports", shortLabel: "Reports", managerOnly: true },
];
