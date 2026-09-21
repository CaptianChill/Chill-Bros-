import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { getFieldNoteInbox, getFieldNoteInboxCounts } from "@/lib/chillbros/field-notes-queries";
import { FIELD_NOTE_STATUS_LABELS, type FieldNoteStatus } from "@/lib/chillbros/field-notes-types";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";

export const dynamic = "force-dynamic";

const STATUS_TONE = {
  submitted: "cyan",
  processing: "cyan",
  needs_review: "amber",
  ready: "cyan",
  approved: "emerald",
  completed: "emerald",
  processing_failed: "rose",
} as const;

const TABS: { key: string; label: string; statuses?: FieldNoteStatus[] }[] = [
  { key: "open", label: "New & Needs Review", statuses: ["submitted", "processing", "needs_review", "ready", "processing_failed"] },
  { key: "approved", label: "Approved", statuses: ["approved"] },
  { key: "completed", label: "Completed", statuses: ["completed"] },
  { key: "all", label: "All" },
];

type Props = { searchParams: Promise<{ tab?: string }> };

export default async function FieldNotesInboxPage({ searchParams }: Props) {
  const profile = await getCurrentStaffProfile();
  if (!profile || profile.role !== "manager") redirect("/");

  const params = await searchParams;
  const activeTab = TABS.find((tab) => tab.key === params.tab) ?? TABS[0];

  const [counts, submissions] = await Promise.all([getFieldNoteInboxCounts(), getFieldNoteInbox(activeTab.statuses)]);

  return (
    <AppShell title="Field Notes Inbox" description="Technician handwritten notes, cleaned up by AI and ready for your review.">
      <div className="space-y-4">
        <SectionCard title="Field Notes">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-[#2d7dff]/20 bg-black/40 p-4"><p className="text-xs uppercase tracking-[0.2em] text-zinc-500">New</p><p className="mt-1 text-3xl font-semibold text-white">{counts.new}</p></div>
            <div className="rounded-2xl border border-amber-400/25 bg-amber-400/5 p-4"><p className="text-xs uppercase tracking-[0.2em] text-amber-200">Needs Review</p><p className="mt-1 text-3xl font-semibold text-white">{counts.needsReview}</p></div>
            <div className="rounded-2xl border border-emerald-400/25 bg-emerald-400/5 p-4"><p className="text-xs uppercase tracking-[0.2em] text-emerald-200">Approved</p><p className="mt-1 text-3xl font-semibold text-white">{counts.approved}</p></div>
          </div>
        </SectionCard>

        <SectionCard title="Inbox">
          <div className="mb-3 flex flex-wrap gap-2">
            {TABS.map((tab) => (
              <Link key={tab.key} href={`/owner/field-notes?tab=${tab.key}`} className={`rounded-xl border px-3 py-1.5 text-xs uppercase tracking-[0.08em] transition ${tab.key === activeTab.key ? "border-[#2d7dff] bg-[#2d7dff]/15 text-white" : "border-[#2d7dff]/20 text-zinc-400 hover:border-[#2d7dff]/45"}`}>{tab.label}</Link>
            ))}
          </div>

          {submissions.length === 0 ? <p className="text-sm text-zinc-500">Nothing here.</p> : (
            <div className="space-y-2 text-left">
              {submissions.map((item) => (
                <Link key={item.id} href={`/owner/field-notes/${item.id}`} className="block rounded-2xl border border-[#2d7dff]/15 bg-black/40 p-3 transition hover:border-[#8ffafa]/40">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-white">{item.customerName ?? item.customerNameFreeform ?? "Unlinked customer"}</p>
                    <div className="flex items-center gap-2">
                      {item.hasConfidenceFlags ? <StatusPill tone="amber">Flagged fields</StatusPill> : null}
                      <StatusPill tone={STATUS_TONE[item.status]}>{FIELD_NOTE_STATUS_LABELS[item.status]}</StatusPill>
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-zinc-400">
                    From {item.technicianName} · {item.imageCount} photo{item.imageCount === 1 ? "" : "s"} · Submitted {new Date(item.submittedAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </AppShell>
  );
}
