"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Menu } from "lucide-react";

import type { NavItem } from "@/lib/chillbros/nav";

const GROUPS = [
  { label: "Operations", hrefs: ["/", "/office", "/dispatch", "/schedule", "/customers", "/scan-send", "/invoices", "/timesheet"] },
  { label: "Field", hrefs: ["/technician", "/equipment", "/training"] },
  { label: "Business", hrefs: ["/agreements", "/inventory", "/reports"] },
  { label: "Admin", hrefs: ["/manager", "/security", "/3d-studio"] },
] as const;

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function AppNavigation({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const activeItem = items.find((item) => isActive(pathname, item.href));
  const knownHrefs = new Set(GROUPS.flatMap((group) => group.hrefs));
  const ungrouped = items.filter((item) => !knownHrefs.has(item.href as (typeof GROUPS)[number]["hrefs"][number]));

  return (
    <nav aria-label="Primary" className="mt-2 border-t border-[#2d7dff]/15 pt-2">
      <details className="group relative">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between rounded-xl border border-[#2d7dff]/25 bg-black/35 px-3 py-2 text-xs font-medium text-[#d9fbff] transition hover:border-[#8ffafa]/45 hover:bg-[#2d7dff]/10 [&::-webkit-details-marker]:hidden">
          <span className="inline-flex min-w-0 items-center gap-2"><Menu className="h-4 w-4 shrink-0 text-[#8ffafa]" /><span className="truncate">{activeItem?.label ?? "Navigation"}</span></span>
          <ChevronDown className="h-4 w-4 shrink-0 transition group-open:rotate-180" />
        </summary>

        <div className="absolute left-0 right-0 z-50 mt-2 max-h-[72dvh] overflow-y-auto rounded-2xl border border-[#2d7dff]/35 bg-[#020407]/[0.99] p-2.5 shadow-[0_18px_60px_rgba(0,0,0,0.7)] backdrop-blur-xl">
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {GROUPS.map((group) => {
              const groupItems = group.hrefs
                .map((href) => items.find((item) => item.href === href))
                .filter((item): item is NavItem => Boolean(item));
              if (groupItems.length === 0) return null;

              return (
                <section key={group.label} className="rounded-xl border border-[#2d7dff]/12 bg-black/20 p-2">
                  <p className="px-1 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8ffafa]/70">{group.label}</p>
                  <div className="grid gap-1.5">
                    {groupItems.map((item) => {
                      const active = isActive(pathname, item.href);
                      return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={`flex min-h-11 items-center rounded-xl border px-3 py-2.5 font-brand text-xs uppercase tracking-[0.08em] transition ${active ? "border-[#8ffafa]/70 bg-[#2d7dff]/20 text-white" : "border-[#2d7dff]/15 bg-black/35 text-[#d9fbff] hover:border-[#8ffafa]/35 hover:bg-[#2d7dff]/10"}`}>{item.label}</Link>;
                    })}
                  </div>
                </section>
              );
            })}

            {ungrouped.length > 0 ? (
              <section className="rounded-xl border border-[#2d7dff]/12 bg-black/20 p-2">
                <p className="px-1 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8ffafa]/70">Other</p>
                <div className="grid gap-1.5">
                  {ungrouped.map((item) => {
                    const active = isActive(pathname, item.href);
                    return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={`flex min-h-11 items-center rounded-xl border px-3 py-2.5 font-brand text-xs uppercase tracking-[0.08em] transition ${active ? "border-[#8ffafa]/70 bg-[#2d7dff]/20 text-white" : "border-[#2d7dff]/15 bg-black/35 text-[#d9fbff] hover:border-[#8ffafa]/35 hover:bg-[#2d7dff]/10"}`}>{item.label}</Link>;
                  })}
                </div>
              </section>
            ) : null}
          </div>
        </div>
      </details>
    </nav>
  );
}
