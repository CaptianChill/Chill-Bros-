"use client";

import { usePathname } from "next/navigation";

const TITLES: Array<[test: (pathname: string) => boolean, label: string]> = [
  [(p) => p === "/", "Command Center"],
  [(p) => p === "/create", "Creation Center"],
  [(p) => p === "/office", "Office Hub"],
  [(p) => p === "/dispatch", "Dispatch"],
  [(p) => p === "/schedule", "Scheduling"],
  [(p) => p === "/customers", "Customer Center"],
  [(p) => p.startsWith("/customers/"), "Customer Profile"],
  [(p) => p === "/scan-send", "Scan & Send"],
  [(p) => p === "/invoices", "Invoices"],
  [(p) => p === "/payments", "Payment Center"],
  [(p) => p === "/agreements", "Monthly Plans"],
  [(p) => p === "/manager", "Manager Hub"],
  [(p) => p === "/security", "Security"],
  [(p) => p === "/technician", "Field Workflow"],
  [(p) => p === "/training", "Tech Assist"],
  [(p) => p.startsWith("/training/model/"), "Tech Training Model"],
  [(p) => p === "/timesheet", "Timesheets"],
  [(p) => p === "/inventory", "Inventory"],
  [(p) => p === "/equipment", "Equipment Database"],
  [(p) => p === "/3d-studio" || p.startsWith("/3d-studio/"), "Tech 3D Studio"],
  [(p) => p === "/reports", "Reports"],
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
      {label}
    </h1>
  );
}
