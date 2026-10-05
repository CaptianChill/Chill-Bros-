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

type OwnerTool = { href: string; title: string; description: string };

// Daily screens (customers, schedule, invoices, payments) are already in the
// main menu, so they are not repeated here. Owner Access holds only what the
// owner needs occasionally, grouped so nothing is hunted for.
const ownerToolGroups: { title: string; description: string; tools: OwnerTool[] }[] = [
  {
    title: "Run the business",
    description: "Money, pricing, staff, and reports.",
    tools: [
      { href: "/reports", title: "Reports", description: "Revenue, outstanding balances, jobs, technician time, and inventory value." },
      { href: "/manager", title: "Manager controls", description: "Estimates, approvals, collections, and staff status." },
      { href: "/inventory", title: "Parts, price book & fees", description: "Stock, cost, retail prices, and fee presets used in estimates." },
      { href: "/payroll", title: "Payroll & paystubs", description: "Open the payroll workspace." },
      { href: "/timesheet", title: "Clock & timesheets", description: "Clock in or out and review hours." },
      { href: "/revenue-radar/opportunities", title: "Sales pipeline & closeout", description: "Full Revenue Radar pipeline, audit, and do-not-contact review." },
    ],
  },
  {
    title: "Settings",
    description: "Company setup and account safety.",
    tools: [
      { href: "/settings/payments", title: "Payments & email", description: "Square setup and a live company-email test." },
      { href: "/security", title: "Security", description: "Review active sessions and sign out other devices." },
    ],
  },
  {
    title: "Extras",
    description: "Creative and training tools, kept out of the daily menus.",
    tools: [
      { href: "/training", title: "Training & Chill Bro Bible", description: "Equipment training and reference." },
      { href: "/3d-studio", title: "3D Studio", description: "3D equipment and project models." },
      { href: "/3d-project-builder", title: "3D Project Builder", description: "Build a 3D walkthrough for a project." },
      { href: "/create", title: "Document Desk", description: "Create owner documents." },
      { href: "/scan-send", title: "Scan & Send", description: "Scan a document and send it." },
    ],
  },
];

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

        {ownerToolGroups.map((group) => (
          <SectionCard key={group.title} eyebrow="Owner only" title={group.title} description={group.description}>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {group.tools.map((tool) => (
                <Link
                  key={tool.href}
                  href={tool.href}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-[#2d7dff]/20 bg-black/40 p-4 text-left transition hover:border-[#8ffafa]/50 hover:bg-[#2d7dff]/10"
                >
                  <div className="min-w-0">
                    <h2 className="font-semibold text-white">{tool.title}</h2>
                    <p className="mt-1 text-sm leading-5 text-zinc-400">{tool.description}</p>
                  </div>
                  <span aria-hidden="true" className="text-[#bafcfc]">→</span>
                </Link>
              ))}
            </div>
          </SectionCard>
        ))}

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
