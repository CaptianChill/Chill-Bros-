"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ChevronDown, Menu, Wrench } from "lucide-react";

import { groupNavItems, isNavItemActive, NAV_ICONS, type NavItem } from "@/lib/chillbros/nav";

export function AppNavigation({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  if (!items.length) return null;

  const current = items.find((item) => isNavItemActive(pathname, item.href));
  const groups = groupNavItems(items);

  return (
    <nav aria-label="Primary" className="mt-2 border-t border-[var(--saber-soft)] pt-2 lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="box flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border px-3 py-2 text-center text-xs font-semibold uppercase tracking-[0.04em] text-white transition"
      >
        <Menu className="h-4 w-4 shrink-0 text-[var(--saber)]" />
        <span className="truncate">{current ? current.shortLabel : "Menu"}</span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-[var(--saber)] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open ? (
        <div className="mt-1.5 space-y-2.5">
          {groups.map((group) => (
            <div key={group.group}>
              <p className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">{group.label}</p>
              <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
                {group.items.map((item) => {
                  const active = isNavItemActive(pathname, item.href);
                  const Icon = NAV_ICONS[item.href] ?? Wrench;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      onClick={() => setOpen(false)}
                      className={`box ${active ? "hot" : ""} flex min-h-11 items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-[0.04em] text-white transition sm:text-xs`}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0 text-[var(--saber)]" />
                      <span className="truncate">{item.shortLabel}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </nav>
  );
}
