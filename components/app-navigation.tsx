"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Banknote,
  CalendarDays,
  ChevronDown,
  CreditCard,
  Home,
  Menu,
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
  const [open, setOpen] = useState(false);

  if (!items.length) return null;

  const current = items.find((item) => isActive(pathname, item.href));

  return (
    <nav aria-label="Primary" className="mt-2 border-t border-[var(--saber-soft)] pt-2">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="box flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border px-3 py-2 text-center text-xs font-semibold uppercase tracking-[0.04em] text-white transition lg:hidden"
      >
        <Menu className="h-4 w-4 shrink-0 text-[var(--saber)]" />
        <span className="truncate">{current ? current.shortLabel : "Menu"}</span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-[var(--saber)] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <div className={`${open ? "grid" : "hidden"} mt-1.5 grid-cols-3 gap-1.5 sm:grid-cols-4 lg:mt-0 lg:grid lg:grid-cols-7`}>
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = ICONS[item.href as keyof typeof ICONS] ?? Wrench;

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
    </nav>
  );
}
