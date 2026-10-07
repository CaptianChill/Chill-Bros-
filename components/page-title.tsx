"use client";

import { usePathname } from "next/navigation";

import { VarsityTitle } from "@/components/varsity-title";

// Screen names match the menu labels so people always know where they are.
const TITLES: Array<[test: (pathname: string) => boolean, label: string]> = [
  [(p) => p === "/", "Home"],
  [(p) => p === "/office", "Home"],
  [(p) => p === "/work", "Work"],
  [(p) => p === "/schedule", "Schedule"],
  [(p) => p === "/dispatch", "Schedule"],
  [(p) => p === "/customers", "Customers"],
  [(p) => p.startsWith("/customers/"), "Customer Profile"],
  [(p) => p === "/jobs/new", "New Service Call"],
  [(p) => p === "/technician" || p.startsWith("/jobs/"), "My Jobs"],
  [(p) => p === "/field-notes", "Notes"],
  [(p) => p === "/timesheet", "Clock"],
  [(p) => p === "/parts-lookup", "Parts Pro"],
  [(p) => p === "/tech-assist" || p.startsWith("/tech-assist/"), "Tech Assist"],
  [(p) => p === "/training", "Training"],
  [(p) => p === "/revenue-radar/handoffs" || p.startsWith("/revenue-radar/handoffs/"), "Send a Lead"],
  [(p) => p === "/revenue-radar" || p.startsWith("/revenue-radar/"), "Sales"],
  [(p) => p === "/agreements", "Service Plans"],
  [(p) => p === "/invoices" || p.startsWith("/invoices/"), "Billing"],
  [(p) => p === "/payments", "Payments"],
  [(p) => p === "/owner" || p.startsWith("/owner/"), "Owner Access"],
  [(p) => p === "/manager", "Manager Controls"],
  [(p) => p === "/reports/track-record", "Track Record"],
  [(p) => p === "/reports", "Reports"],
  [(p) => p === "/payroll", "Payroll"],
  [(p) => p === "/inventory", "Parts & Price Book"],
  [(p) => p === "/equipment" || p.startsWith("/equipment/"), "Equipment"],
  [(p) => p === "/security", "Security"],
  [(p) => p === "/settings/payments", "Payments & Email"],
  [(p) => p === "/create", "Document Desk"],
  [(p) => p === "/scan-send", "Scan & Send"],
];

/** Short screen name for a route, or null when the route has no fixed name. */
export function titleForPath(pathname: string) {
  return TITLES.find(([test]) => test(pathname))?.[1] ?? null;
}

export function PageTitle() {
  const pathname = usePathname();
  const label = titleForPath(pathname) ?? "Chill Bros";

  return (
    <h1 className="glo w-full text-center font-serif text-[1.35rem] font-black italic uppercase leading-tight tracking-[0.015em] sm:text-[1.8rem]">
      <VarsityTitle text={label} fuzz />
    </h1>
  );
}
