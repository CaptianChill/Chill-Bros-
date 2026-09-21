import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { ManagerUserPanel } from "@/components/manager-user-panel";
import { SectionCard } from "@/components/section-card";
import { getStaffAccounts } from "@/lib/chillbros/queries";
import { getFieldNoteInboxCounts } from "@/lib/chillbros/field-notes-queries";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";

export const dynamic = "force-dynamic";

const OWNER_EMAIL = "chillprostx@gmail.com";

const ownerTools = [
  {
    href: "/manager",
    eyebrow: "Operations",
    title: "Manager controls",
    description: "Review active estimates and invoices, pricing adjustments, staff status, approvals, collections, and workflow activity.",
  },
  {
    href: "/inventory",
    eyebrow: "Pricing",
    title: "Parts, price book & service fees",
    description: "Edit parts, stock, cost, retail pricing, service prices, descriptions, and the fee presets used in estimates.",
  },
  {
    href: "/customers",
    eyebrow: "Customers",
    title: "Customer records",
    description: "Open the customer workspace to maintain customer information and review the records tied to service work.",
  },
  {
    href: "/settings/payments",
    eyebrow: "Company setup",
    title: "Payments & email",
    description: "Review the Square payment setup and send a live company-email test from the signed-in owner account.",
  },
  {
    href: "/schedule",
    eyebrow: "Scheduling",
    title: "Schedule & assignments",
    description: "Create, move, and review scheduled calls and technician assignments without exposing owner controls to field staff.",
  },
  {
    href: "/invoices",
    eyebrow: "Billing",
    title: "Quotes & invoices",
    description: "Create and edit quotes or invoices, finalize documents, email customers, and manage payment status.",
  },
  {
    href: "/payments",
    eyebrow: "Billing",
    title: "Record a payment",
    description: "Log cash, check, ACH, or other manual payments against an approved invoice.",
  },
  {
    href: "/revenue-radar/opportunities",
    eyebrow: "Sales",
    title: "Sales pipeline & closeout",
    description: "The full Revenue Radar pipeline, follow-up tasks, technician handoffs, audit, and DNC review — for when you need to dig in.",
  },
] as const;

export default async function OwnerAccessPage() {
  const profile = await getCurrentStaffProfile();
  const isOwner = profile?.role === "manager" && profile.email.trim().toLowerCase() === OWNER_EMAIL;

  if (!isOwner) redirect("/");

  const [accounts, fieldNoteCounts] = await Promise.all([getStaffAccounts(), getFieldNoteInboxCounts().catch(() => null)]);

  return (
    <AppShell title="Owner Control Center">
      <div className="space-y-4">
        <SectionCard eyebrow="Technician intake" title="Field Notes" description="Eric's handwritten service notes, cleaned up by AI and waiting on your review.">
          {!fieldNoteCounts ? <p role="alert">Field Notes could not load. Open the inbox to retry.</p> : null}
          <Link href="/owner/field-notes" className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-[#2d7dff]/20 bg-black/40 p-4 text-left transition hover:border-[#8ffafa]/50"><p className="text-xs uppercase tracking-[0.2em] text-zinc-500">New</p><p className="mt-1 text-3xl font-semibold text-white">{fieldNoteCounts?.new ?? "—"}</p></div>
            <div className="rounded-2xl border border-amber-400/25 bg-amber-400/5 p-4 text-left transition hover:border-amber-300/60"><p className="text-xs uppercase tracking-[0.2em] text-amber-200">Needs Review</p><p className="mt-1 text-3xl font-semibold text-white">{fieldNoteCounts?.needsReview ?? "—"}</p></div>
            <div className="rounded-2xl border border-emerald-400/25 bg-emerald-400/5 p-4 text-left transition hover:border-emerald-300/60"><p className="text-xs uppercase tracking-[0.2em] text-emerald-200">Approved</p><p className="mt-1 text-3xl font-semibold text-white">{fieldNoteCounts?.approved ?? "—"}</p></div>
          </Link>
        </SectionCard>

        <SectionCard
          eyebrow="Owner only"
          title="Business controls"
          description="The operating app stays simple for technicians and office staff. Owner-only and manager-level tools are collected here so you can edit the business without cluttering the field workflow."
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {ownerTools.map((tool) => (
              <Link
                key={tool.href}
                href={tool.href}
                className="box group flex min-h-40 flex-col justify-between rounded-2xl border border-[#2d7dff]/20 bg-black/40 p-4 text-left transition hover:border-[#8ffafa]/50 hover:bg-[#2d7dff]/10"
              >
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8ffafa]">{tool.eyebrow}</p>
                  <h2 className="mt-2 text-lg font-semibold text-white">{tool.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">{tool.description}</p>
                </div>
                <p className="mt-4 text-xs font-semibold uppercase tracking-[0.12em] text-[#bafcfc]">Open controls →</p>
              </Link>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          eyebrow="Owner only"
          title="Employee logins & access"
          description="Add employee accounts, reset login credentials, and activate or deactivate staff. These controls remain hidden from normal manager, office, and technician accounts."
        >
          <ManagerUserPanel accounts={accounts} canManageCredentials />
        </SectionCard>
      </div>
    </AppShell>
  );
}
