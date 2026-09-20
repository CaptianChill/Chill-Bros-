import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { SectionCard } from "@/components/section-card";
import { FieldNotesReviewPanel } from "@/components/field-notes-review-panel";
import { getFieldNoteSubmission } from "@/lib/chillbros/field-notes-queries";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function FieldNoteDetailPage({ params }: Props) {
  const profile = await getCurrentStaffProfile();
  if (!profile || profile.role !== "manager") redirect("/");

  const { id } = await params;
  const submission = await getFieldNoteSubmission(id);
  if (!submission) notFound();

  return (
    <AppShell title="Field Note Review" description="Original handwritten note beside the AI-cleaned service record.">
      <div className="mx-auto max-w-5xl space-y-4">
        <Link href="/owner/field-notes" className="inline-flex items-center gap-2 text-sm text-[#8ffafa]"><ArrowLeft className="h-4 w-4" />Back to inbox</Link>
        <SectionCard title="Review">
          <FieldNotesReviewPanel submission={submission} />
        </SectionCard>
      </div>
    </AppShell>
  );
}
