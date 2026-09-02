export type NavItem = {
  href: string;
  label: string;
  shortLabel: string;
};

export type TechnicianAccount = {
  id: string;
  name: string;
  email: string;
  role: "Technician" | "Manager / Owner" | "Client / Customer";
  status: "Active" | "Inactive";
  assignedJobs: number;
  lastClockEvent: string;
  tempPassword: string;
};

export type PartsCatalogItem = {
  id: string;
  name: string;
  partNumber: string;
  defaultCost: number;
  retailPrice: number;
  stock: number;
};

export type CustomerRecord = {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  history: string[];
  lastEmail: string;
};

export const navItems: NavItem[] = [
  { href: "/", label: "Command Center", shortLabel: "Home" },
  { href: "/manager", label: "Manager Hub", shortLabel: "Manager" },
  { href: "/technician", label: "Tech Workflow", shortLabel: "Tech" },
  { href: "/timesheet", label: "Timesheets", shortLabel: "Time" },
  { href: "/inventory", label: "Inventory", shortLabel: "Parts" },
  { href: "/crm", label: "Customer CRM", shortLabel: "CRM" },
  { href: "/portal/INV-2409", label: "Client Portal", shortLabel: "Portal" },
];

export const dashboardMetrics = [
  { label: "Open dispatch jobs", value: "14", detail: "4 same-day approvals pending" },
  { label: "Customer approvals today", value: "7", detail: "3 ready for parts ordering" },
  { label: "Inventory alerts", value: "5", detail: "Low stock items need reorder" },
  { label: "Outbound email events", value: "18", detail: "Every message copies chillbrostx@gmail.com" },
];

export const workflowBoard = [
  {
    title: "Approval queue",
    count: 4,
    items: [
      "Smith rooftop condenser repair awaiting owner approval",
      "Delgado mini-split leak search flagged for parts order",
      "Northside Bistro invoice approved through client portal",
    ],
  },
  {
    title: "Technician field status",
    count: 6,
    items: [
      "2 clocked in on active service calls",
      "1 on drive time toward emergency service",
      "3 finishing media uploads and quote sign-off",
    ],
  },
  {
    title: "Payment watch",
    count: 3,
    items: [
      "1 Apple Pay authorization pending",
      "1 Zelle confirmation awaiting manual verification",
      "1 card payment settled and receipt emailed",
    ],
  },
];

export const technicianAccounts: TechnicianAccount[] = [
  {
    id: "tech-1",
    name: "Derek Frost",
    email: "derek@chillbros.local",
    role: "Technician",
    status: "Active",
    assignedJobs: 4,
    lastClockEvent: "Clocked in 7:12 AM",
    tempPassword: "TEMP-8841",
  },
  {
    id: "tech-2",
    name: "Monica Snow",
    email: "monica@chillbros.local",
    role: "Technician",
    status: "Active",
    assignedJobs: 3,
    lastClockEvent: "Drive time logged 12:05 PM",
    tempPassword: "TEMP-5520",
  },
  {
    id: "mgr-1",
    name: "Alex Chill",
    email: "owner@chillbros.local",
    role: "Manager / Owner",
    status: "Active",
    assignedJobs: 0,
    lastClockEvent: "Reviewing approval queue",
    tempPassword: "OWNER-0001",
  },
];

export const partsCatalog: PartsCatalogItem[] = [
  {
    id: "part-1",
    name: "Dual Run Capacitor 45/5",
    partNumber: "CB-CAP-45-5",
    defaultCost: 28,
    retailPrice: 95,
    stock: 9,
  },
  {
    id: "part-2",
    name: "Contactor 2 Pole 40A",
    partNumber: "CB-CON-40A",
    defaultCost: 17,
    retailPrice: 74,
    stock: 6,
  },
  {
    id: "part-3",
    name: "Blower Motor 1/2 HP",
    partNumber: "CB-MTR-12HP",
    defaultCost: 149,
    retailPrice: 295,
    stock: 2,
  },
  {
    id: "part-4",
    name: "UV Dye Leak Kit",
    partNumber: "CB-DYE-UV",
    defaultCost: 22,
    retailPrice: 68,
    stock: 12,
  },
];

export const feeSettings = [
  { label: "Dispatch fee", amount: 89 },
  { label: "Arrival fee", amount: 59 },
  { label: "After-hours multiplier", amount: 125 },
];

export const customerDirectory: CustomerRecord[] = [
  {
    id: "cust-1",
    name: "Jordan Smith",
    address: "1440 Falcon Ridge, Austin, TX",
    phone: "(512) 555-0140",
    email: "jordan.smith@example.com",
    history: ["AC tune-up • May 2026", "Capacitor replacement • Jul 2026"],
    lastEmail: "Invoice ready • 2:40 PM",
  },
  {
    id: "cust-2",
    name: "Northside Bistro",
    address: "890 Lamar Blvd, Austin, TX",
    phone: "(512) 555-0198",
    email: "ops@northsidebistro.com",
    history: ["Walk-in cooler fan motor • Jan 2026", "Emergency refrigerant refill • Aug 2026"],
    lastEmail: "Payment receipt • 11:08 AM",
  },
  {
    id: "cust-3",
    name: "Lena Delgado",
    address: "603 Mesa Vista, Round Rock, TX",
    phone: "(737) 555-0173",
    email: "lena.delgado@example.com",
    history: ["Mini-split annual cleaning • Mar 2026"],
    lastEmail: "Quote sent • 9:12 AM",
  },
];

export const emailLog = [
  {
    subject: "Quote sent • INV-2409",
    recipients: "jordan.smith@example.com, chillbrostx@gmail.com",
    status: "Delivered",
  },
  {
    subject: "Customer approval received • INV-2408",
    recipients: "owner@chillbros.local, chillbrostx@gmail.com",
    status: "Alerted",
  },
  {
    subject: "Payment receipt • INV-2407",
    recipients: "ops@northsidebistro.com, chillbrostx@gmail.com",
    status: "Delivered",
  },
];

export const serviceJob = {
  id: "JOB-1182",
  customer: "Jordan Smith",
  location: "1440 Falcon Ridge, Austin, TX",
  assignedTech: "Derek Frost",
  scheduledWindow: "2:00 PM - 4:00 PM",
  scope: "Condenser not cooling, inspect capacitor, contactor, and refrigerant pressures.",
  workPerformed:
    "Confirmed failed dual run capacitor, cleaned condenser coil, verified amperage draw, and restored system cooling.",
  laborHours: 1.5,
  driveHours: 0.6,
  partsUsed: [partsCatalog[0], partsCatalog[1]],
  beforePhotos: ["Condenser panel before service", "Swollen capacitor close-up"],
  afterPhotos: ["New capacitor installed", "System running at target temperature split"],
};

export const quoteBreakdown = [
  { label: "Dispatch fee", amount: 89 },
  { label: "Arrival fee", amount: 59 },
  { label: "Labor (1.5 hrs)", amount: 210 },
  { label: "Dual Run Capacitor 45/5", amount: 95 },
  { label: "Contactor 2 Pole 40A", amount: 74 },
];

export const paymentOptions = ["Cash App", "Venmo", "Zelle", "Apple Pay", "Credit / Debit Card"];

export const roleAccess = [
  {
    role: "Manager / Owner",
    access: ["Inventory & pricing", "Approval workflows", "Technician credential control", "Email and order review"],
  },
  {
    role: "Technician",
    access: ["Assigned jobs only", "Timesheets", "Service sheet + media uploads", "On-site customer sign-off"],
  },
  {
    role: "Client / Customer",
    access: ["Secure portal view", "Digital approval", "Payment selection", "Before/after proof of work"],
  },
];

export const portalInvoice = {
  invoiceId: "INV-2409",
  customerName: "Jordan Smith",
  status: "Awaiting customer approval",
  workSummary: serviceJob.workPerformed,
  notes: "Customer requested same-day repair and emailed receipt copy.",
};
