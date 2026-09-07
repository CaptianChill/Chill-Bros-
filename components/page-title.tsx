"use client";

import { usePathname } from "next/navigation";

const TITLES: Array<[test: (pathname: string) => boolean, label: string]> = [
  [(p) => p === "/", "Command Center"],
  [(p) => p === "/create", "Creation Center"],
  [(p) => p === "/office", "Office Hub"],
  [(p) => p === "/dispatch", "Dispatch"],
  [(p) => p === "/customers", "Customer Center"],
  [(p) => p.startsWith("/customers/"), "Customer Profile"],
  [(p) => p === "/scan-send", "Scan & Send"],
  [(p) => p === "/invoices", "Invoices"],
  [(p) => p === "/payments", "Payment Center"],
  [(p) => p === "/agreements", "Monthly Plans"],
  [(p) => p === "/manager", "Manager Hub"],
  [(p) => p === "/security", "Security"],
  [(p) => p === "/technician", "Field Workflow"],
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
    <div className="relative flex min-h-12 w-full items-center justify-between gap-2 overflow-visible sm:gap-3">
      <div className="relative z-20 flex h-10 w-10 shrink-0 items-center justify-center overflow-visible sm:h-12 sm:w-12">
        <img
          src="/internal/chill-bros-smiley-v4.png"
          alt=""
          aria-hidden="true"
          width={96}
          height={96}
          loading="eager"
          decoding="sync"
          className="block h-full w-full max-w-none object-contain [clip-path:none] [filter:none] [transform:none]"
          style={{ WebkitTransform: "none", transform: "none", filter: "none" }}
        />
      </div>

      <h1 className="relative z-10 min-w-0 flex-1 text-center font-serif text-[1.35rem] font-black italic uppercase leading-tight tracking-[0.015em] text-[#071126] [-webkit-text-stroke:1px_#9ffcff] [text-shadow:0_0_2px_#ffffff,0_0_6px_#8ffcff,0_0_12px_#2d7dff,0_0_22px_#0057ff] sm:text-[1.8rem]">
        {label}
      </h1>

      <div className="relative z-20 flex h-10 w-11 shrink-0 items-center justify-center overflow-visible sm:h-12 sm:w-14">
        <img
          src="/internal/chill-bros-texas-v3.png"
          alt=""
          aria-hidden="true"
          width={64}
          height={64}
          loading="eager"
          decoding="sync"
          className="block h-full w-full max-w-none object-contain [clip-path:none] [filter:none] [transform:none]"
          style={{ WebkitTransform: "none", transform: "none", filter: "none" }}
        />
      </div>
    </div>
  );
}
