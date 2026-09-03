export type NavItem = {
  href: string;
  label: string;
  shortLabel: string;
};

export const navItems: NavItem[] = [
  { href: "/", label: "Command Center", shortLabel: "Home" },
  { href: "/manager", label: "Manager Hub", shortLabel: "Manager" },
  { href: "/technician", label: "Tech Workflow", shortLabel: "Tech" },
  { href: "/timesheet", label: "Timesheets", shortLabel: "Time" },
  { href: "/inventory", label: "Inventory", shortLabel: "Parts" },
  { href: "/crm", label: "Customer CRM", shortLabel: "CRM" },
];
