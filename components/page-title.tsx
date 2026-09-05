"use client";

import { usePathname } from "next/navigation";

const TITLES: Array<[test: (pathname: string) => boolean, label: string]> = [
  [(p) => p === "/", "Command Center"],
  [(p) => p === "/office", "Office Hub"],
  [(p) => p === "/dispatch", "Dispatch"],
  [(p) => p === "/customers", "Customer Center"],
  [(p) => p.startsWith("/customers/"), "Customer Profile"],
  [(p) => p === "/agreements", "Monthly Plans"],
  [(p) => p === "/manager", "Manager Hub"],
  [(p) => p === "/security", "Security"],
  [(p) => p === "/technician", "Tech Workflow"],
  [(p) => p === "/training", "Training Bible"],
  [(p) => p.startsWith("/training/model/"), "Training Model"],
  [(p) => p === "/timesheet", "Timesheets"],
  [(p) => p === "/inventory", "Inventory"],
  [(p) => p === "/equipment", "Equipment"],
  [(p) => p === "/3d-studio" || p.startsWith("/3d-studio/"), "3D Studio"],
  [(p) => p === "/reports", "Reports"],
];

export function PageTitle() {
  const pathname = usePathname();
  const label = TITLES.find(([test]) => test(pathname))?.[1] ?? "Chill Bros";

  return (
    <h1 className="w-full truncate text-center font-serif text-[1.45rem] font-black italic uppercase leading-none tracking-[0.015em] text-[#071126] [-webkit-text-stroke:1px_#9ffcff] [text-shadow:0_0_2px_#ffffff,0_0_6px_#8ffcff,0_0_12px_#2d7dff,0_0_22px_#0057ff] sm:text-[1.8rem]">
      {label}
    </h1>
  );
}
