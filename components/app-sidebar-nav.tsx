"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wrench } from "lucide-react";

import { groupNavItems, isNavItemActive, NAV_ICONS, type NavItem } from "@/lib/chillbros/nav";

export function AppSidebarNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const groups = groupNavItems(items);

  return (
    <nav aria-label="Primary" className="flex-1 space-y-5 overflow-y-auto py-1">
      {groups.map((group) => (
        <div key={group.group}>
          <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">{group.label}</p>
          <div className="space-y-0.5">
            {group.items.map((item) => {
              const active = isNavItemActive(pathname, item.href);
              const Icon = NAV_ICONS[item.href] ?? Wrench;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-2.5 rounded-lg border px-2.5 py-2 text-sm font-medium transition ${
                    active
                      ? "border-[var(--saber-soft)] bg-[var(--saber)]/10 text-white"
                      : "border-transparent text-zinc-400 hover:border-[var(--saber-soft)] hover:bg-white/[0.03] hover:text-white"
                  }`}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${active ? "text-[var(--saber)]" : "text-zinc-500"}`} />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
