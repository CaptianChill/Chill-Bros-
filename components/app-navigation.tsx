"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, ChevronDown, Home, Menu, PlusSquare, Wrench } from "lucide-react";

import type { NavItem } from "@/lib/chillbros/nav";

const PRIMARY = [
  { href: "/", label: "Home", icon: Home },
  { href: "/schedule", label: "Schedule", icon: CalendarDays },
  { href: "/create", label: "Create", icon: PlusSquare },
  { href: "/training", label: "Tech Assist", icon: Wrench },
] as const;

const GROUPS = [
  { label: "Operations", hrefs: ["/office", "/dispatch", "/technician", "/timesheet", "/scan-send", "/customers"] },
  { label: "Billing", hrefs: ["/invoices", "/payments", "/settings/payments", "/payroll", "/agreements"] },
  { label: "Assets", hrefs: ["/equipment", "/inventory"] },
  { label: "Management", hrefs: ["/reports", "/manager", "/security"] },
] as const;

const HIDDEN_FROM_MORE = new Set(["/3d-studio", "/invoices/new"]);

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/create") {
    return pathname === "/create" || pathname.startsWith("/3d-project-builder") || pathname.startsWith("/invoices/new");
  }
  if (href === "/training") {
    return pathname === "/training" || pathname.startsWith("/training/model/") || pathname.startsWith("/3d-studio");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppNavigation({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const availableHrefs = new Set(items.map((item) => item.href));
  const primaryItems = PRIMARY.filter((item) => availableHrefs.has(item.href));
  const knownHrefs = new Set([
    ...PRIMARY.map((item) => item.href),
    ...GROUPS.flatMap((group) => group.hrefs),
    ...HIDDEN_FROM_MORE,
  ]);
  const ungrouped = items.filter((item) => !knownHrefs.has(item.href));

  return (
    <nav aria-label="Primary" className="mt-2 border-t border-[var(--saber-soft)] pt-2">
      <div className="grid grid-cols-4 gap-1.5">
        {primaryItems.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`box ${active ? "hot" : ""} flex min-h-10 items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-[10px] font-semibold uppercase tracking-[0.05em] text-white transition sm:text-xs`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0 text-[var(--saber)]" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>

      <details className="group relative mt-1.5">
        <summary className="box flex min-h-10 cursor-pointer list-none items-center justify-between rounded-xl bg-[#020407] px-3 py-2 text-[12px] font-semibold text-white transition [&::-webkit-details-marker]:hidden">
          <span className="inline-flex min-w-0 items-center gap-2">
            <Menu className="h-4 w-4 shrink-0 text-[var(--saber)]" />
            <span className="truncate">More tools</span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 transition group-open:rotate-180" />
        </summary>

        <div className="absolute left-0 right-0 z-50 mt-2 max-h-[72dvh] overflow-y-auto rounded-2xl border border-[#2d7dff]/45 bg-[#020407] p-2.5 shadow-[0_18px_60px_rgba(0,0,0,.72)]">
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {GROUPS.map((group) => {
              const groupItems = group.hrefs
                .map((href) => items.find((item) => item.href === href))
                .filter((item): item is NavItem => Boolean(item));
              if (groupItems.length === 0) return null;

              return (
                <section key={group.label} className="rounded-xl border border-[#2d7dff]/25 bg-[#050912] p-2">
                  <p className="sub px-1 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em]">{group.label}</p>
                  <div className="grid gap-1.5">
                    {groupItems.map((item) => {
                      const active = isActive(pathname, item.href);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          aria-current={active ? "page" : undefined}
                          className={`box ${active ? "hot" : ""} flex min-h-10 items-center justify-center rounded-xl bg-[#020407] px-3 py-2 text-center text-[12px] font-semibold uppercase tracking-[0.04em] text-white transition`}
                        >
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                </section>
              );
            })}

            {ungrouped.length > 0 ? (
              <section className="rounded-xl border border-[#2d7dff]/25 bg-[#050912] p-2">
                <p className="sub px-1 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em]">Other</p>
                <div className="grid gap-1.5">
                  {ungrouped.map((item) => {
                    const active = isActive(pathname, item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={`box ${active ? "hot" : ""} flex min-h-10 items-center justify-center rounded-xl bg-[#020407] px-3 py-2 text-center text-[12px] font-semibold uppercase tracking-[0.04em] text-white transition`}
                      >
                        {item.label}
                      </Link>
                    );
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
