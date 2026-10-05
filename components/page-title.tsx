"use client";

import { usePathname } from "next/navigation";

import { VarsityTitle } from "@/components/varsity-title";

// Screen names match the menu labels so people always know where they are.
const TITLES: Array<[test: (pathname: string) => boolean, label: string]> = [
  [(p) => p === "/", "Home"],
  [(p) => p === "/office", "Office"],
  [(p) => p === "/work", "Open Work"],
  [(p) => p === "/schedule", "Schedule"],
  [(p) => p === "/dispatch", "Dispatch"],
  [(p) => p === "/customers", "Customers"],
  [(p) => p.startsWith("/customers/"), "Customer Profile"],
  [(p) => p === "/jobs/new", "New Service Call"],
  [(p) => p === "/technician" || p.startsWith("/jobs/"), "Field Jobs"],
  [(p) => p === "/field-notes", "Field Notes"],
  [(p) => p === "/timesheet", "Clock"],
  [(p) => p === "/parts-lookup", "Parts Pro"],
  [(p) => p === "/tech-assist" || p.startsWith("/tech-assist/"), "Tech Assist"],
  [(p) => p === "/training", "Training"],
  [(p) => p.startsWith("/training/model/"), "Training Model"],
  [(p) => p === "/revenue-radar" || p.startsWith("/revenue-radar/"), "Revenue Radar"],
  [(p) => p === "/agreements", "Service Plans"],
  [(p) => p === "/invoices" || p.startsWith("/invoices/"), "Quotes & Invoices"],
  [(p) => p === "/payments", "Payments"],
  [(p) => p === "/owner" || p.startsWith("/owner/"), "Owner Access"],
  [(p) => p === "/manager", "Manager Controls"],
  [(p) => p === "/reports", "Reports"],
  [(p) => p === "/payroll", "Payroll"],
  [(p) => p === "/inventory", "Parts & Price Book"],
  [(p) => p === "/equipment" || p.startsWith("/equipment/"), "Equipment"],
  [(p) => p === "/security", "Security"],
  [(p) => p === "/settings/payments", "Payments & Email"],
  [(p) => p === "/create", "Document Desk"],
  [(p) => p === "/scan-send", "Scan & Send"],
  [(p) => p === "/3d-studio" || p.startsWith("/3d-studio/"), "3D Studio"],
  [(p) => p === "/3d-project-builder" || p.startsWith("/3d-project-builder/"), "3D Project Builder"],
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
