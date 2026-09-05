"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Menu } from "lucide-react";

import type { NavItem } from "@/lib/chillbros/nav";

export function AppNavigation({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const activeItem = items.find((item) => item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`));

  return (
    <nav aria-label="Primary" className="mt-2 border-t border-[#2d7dff]/15 pt-2">
      <details className="group relative">
        <summary className="flex cursor-pointer list-none items-center justify-between rounded-xl border border-[#2d7dff]/25 bg-black/35 px-3 py-2 text-xs font-medium text-[#d9fbff] transition hover:border-[#8ffafa]/45 hover:bg-[#2d7dff]/10 [&::-webkit-details-marker]:hidden">
          <span className="inline-flex min-w-0 items-center gap-2"><Menu className="h-4 w-4 shrink-0 text-[#8ffafa]" /><span className="truncate">{activeItem?.label ?? "Navigation"}</span></span>
          <ChevronDown className="h-4 w-4 shrink-0 transition group-open:rotate-180" />
        </summary>
        <div className="absolute left-0 right-0 z-50 mt-2 grid max-h-[65vh] gap-1.5 overflow-y-auto rounded-2xl border border-[#2d7dff]/35 bg-[#020407]/[0.99] p-2 shadow-[0_18px_60px_rgba(0,0,0,0.7)] backdrop-blur-xl sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={`rounded-xl border px-3 py-2.5 font-brand text-xs uppercase tracking-[0.1em] transition ${active ? "border-[#8ffafa]/70 bg-[#2d7dff]/20 text-white" : "border-[#2d7dff]/15 bg-black/35 text-[#d9fbff] hover:border-[#8ffafa]/35 hover:bg-[#2d7dff]/10"}`}>{item.label}</Link>;
          })}
        </div>
      </details>
    </nav>
  );
}
