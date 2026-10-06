"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { sectionTabsFor } from "@/lib/chillbros/nav";
import type { StaffRole } from "@/lib/chillbros/types";

// Switch between pages that share one menu entry: Board / Calendar,
// Quotes & Invoices / Payments, Leads / Service Plans / Sales Tasks.
export function SectionTabs({ role }: { role: StaffRole }) {
  const pathname = usePathname();
  const section = sectionTabsFor(pathname, role);
  if (!section) return null;
  return (
    <nav aria-label="Section" className="mb-3.5 flex gap-1 overflow-x-auto rounded-2xl border border-[#0A1A33]/10 bg-white/80 p-1 backdrop-blur">
      {section.tabs.map((tab) => {
        const active = tab.href === section.activeHref;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-10 flex-1 items-center justify-center whitespace-nowrap rounded-xl px-3 text-sm font-semibold transition ${active ? "bg-[#1B3FD0] text-white shadow-sm" : "text-[#1B3FD0] hover:bg-[#1B3FD0]/10"}`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
