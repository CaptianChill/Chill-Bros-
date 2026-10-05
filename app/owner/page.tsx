import Link from "next/link";
import { BarChart3, Box, Boxes, Clock3, CreditCard, FileText, GraduationCap, Package, Radar, ScanLine, ShieldCheck, SlidersHorizontal, Wallet, type LucideIcon } from "lucide-react";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { ManagerUserPanel } from "@/components/manager-user-panel";
import { SectionCard } from "@/components/section-card";
import { getStaffAccounts } from "@/lib/chillbros/queries";
import { getFieldNoteInboxCounts } from "@/lib/chillbros/field-notes-queries";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";

export const dynamic = "force-dynamic";

const OWNER_EMAIL = "chillprostx@gmail.com";

type OwnerTool = { href: string; title: string; description: string; icon: LucideIcon };

// Daily screens (customers, schedule, invoices, payments) are already in the
// main menu, so they are not repeated here. Owner Access holds only what the
// owner needs occasionally, grouped so nothing is hunted for.
const ownerToolGroups: { title: string; description: string; tools: OwnerTool[] }[] = [
  {
    title: "Run the business",
    description: "Money, pricing, staff, and reports.",
    tools: [
      { href: "/reports", title: "Reports", description: "Revenue, outstanding balances, jobs, technician time, and inventory value.", icon: BarChart3 },
      { href: "/manager", title: "Manager controls", description: "Estimates, approvals, collections, and staff status.", icon: SlidersHorizontal },
      { href: "/inventory", title: "Parts, price book & fees", description: "Stock, cost, retail prices, and fee presets used in estimates.", icon: Package },
      { href: "/payroll", title: "Payroll & paystubs", description: "Open the payroll workspace.", icon: Wallet },
      { href: "/timesheet", title: "Clock & timesheets", description: "Clock in or out and review hours.", icon: Clock3 },
      { href: "/revenue-radar/opportunities", title: "Sales pipeline & closeout", description: "Full Revenue Radar pipeline, audit, and do-not-contact review.", icon: Radar },
    ],
  },
  {
    title: "Settings",
    description: "Company setup and account safety.",
    tools: [
      { href: "/settings/payments", title: "Payments & email", description: "Square setup and a live company-email test.", icon: CreditCard },
      { href: "/security", title: "Security", description: "Review active sessions and sign out other devices.", icon: ShieldCheck },
    ],
  },
  {
    title: "Extras",
    description: "Creative and training tools, kept out of the daily menus.",
    tools: [
      { href: "/training", title: "Training & Chill Bro Bible", description: "Equipment training and reference.", icon: GraduationCap },
      { href: "/3d-studio", title: "3D Studio", description: "3D equipment and project models.", icon: Box },
      { href: "/3d-project-builder", title: "3D Project Builder", description: "Build a 3D walkthrough for a project.", icon: Boxes },
      { href: "/create", title: "Document Desk", description: "Create owner documents.", icon: FileText },
      { href: "/scan-send", title: "Scan & Send", description: "Scan a document and send it.", icon: ScanLine },
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
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
              {group.tools.map((tool) => (
                <Link
                  key={tool.href}
                  href={tool.href}
                  title={tool.description}
                  className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-2xl border border-[#2d7dff]/25 bg-black/45 p-3 text-center transition hover:border-[#8ffafa]/55 hover:bg-[#2d7dff]/10"
                >
                  <tool.icon className="h-6 w-6 text-[#8ffafa]" aria-hidden="true" />
                  <span className="text-sm font-semibold leading-tight text-white">{tool.title}</span>
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
