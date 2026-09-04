"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { NavItem } from "@/lib/chillbros/nav";

export function AppNavigation({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary" className="no-scrollbar mt-2 flex gap-1.5 overflow-x-auto pb-0.5 sm:mt-3 sm:gap-2 sm:pb-1">
      {items.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap rounded-full border px-3 py-1.5 font-brand text-[10px] uppercase tracking-[0.12em] transition sm:px-4 sm:py-2 sm:text-sm ${active ? "border-[#8ffafa]/80 bg-[#2d7dff]/20 text-white shadow-[0_0_12px_rgba(45,125,255,0.42)]" : "border-[#2d7dff]/30 bg-black/35 text-[#d9fbff] shadow-[0_0_8px_rgba(45,125,255,0.16)] hover:border-[#8ffafa]/45 hover:bg-[#2d7dff]/15"}`}
          >
            <span className="sm:hidden">{item.shortLabel}</span>
            <span className="hidden sm:inline">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
