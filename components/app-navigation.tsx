"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Banknote,
  CalendarDays,
  CreditCard,
  Home,
  Route,
  UsersRound,
  Wrench,
  Clock3,
} from "lucide-react";

import type { NavItem } from "@/lib/chillbros/nav";

const ICONS = {
  "/": Home,
  "/office": Home,
  "/schedule": CalendarDays,
  "/dispatch": Route,
  "/customers": UsersRound,
  "/technician": Wrench,
  "/invoices": Banknote,
  "/payments": CreditCard,
  "/timesheet": Clock3,
} as const;

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/technician") return pathname === "/technician" || pathname.startsWith("/jobs/");
  if (href === "/invoices") return pathname === "/invoices" || pathname.startsWith("/invoices/");
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppNavigation({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  if (!items.length) return null;

  return (
    <nav aria-label="Primary" className="mt-2 border-t border-[var(--saber-soft)] pt-2">
      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 lg:grid-cols-7">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = ICONS[item.href as keyof typeof ICONS] ?? Wrench;

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`box ${active ? "hot" : ""} flex min-h-11 items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-[0.04em] text-white transition sm:text-xs`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0 text-[var(--saber)]" />
              <span className="truncate">{item.shortLabel}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
