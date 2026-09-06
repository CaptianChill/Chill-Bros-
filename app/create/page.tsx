import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { CreationCenter } from "@/components/creation-center";
import { StatusPill } from "@/components/status-pill";
import { getActiveTechnicians, getDispatchJobs } from "@/lib/chillbros/operations-queries";
import { getCustomers } from "@/lib/chillbros/queries";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import { createServiceRoleClient } from "@/lib/supabase/service-client";

export const dynamic = "force-dynamic";

async function getBillingSummary(jobIds: string[]) {
  if (jobIds.length === 0) return [];
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("chillbros_invoices")
    .select("job_id,invoice_number,portal_token,status,payment_status,updated_at")
    .in("job_id", jobIds)
    .is("revoked_at", null)
    .neq("status", "void")
    .order("updated_at", { ascending: false });
  if (error || !data) return [];
  const seen = new Set<string>();
  return data.flatMap((row) => {
    if (!row.job_id || seen.has(row.job_id)) return [];
    seen.add(row.job_id);
    return [{
      jobId: row.job_id,
      invoiceNumber: row.invoice_number,
      portalToken: row.portal_token,
      status: row.status as "draft" | "awaiting_approval" | "approved" | "void",
      paymentStatus: row.payment_status as "unpaid" | "pending_manual_review" | "paid",
    }];
  });
}

export default async function CreatePage() {
  const profile = await getCurrentStaffProfile();
  if (!profile) redirect("/sign-in");
  if (profile.role !== "manager") redirect("/");

  const [customers, technicians, jobs] = await Promise.all([
    getCustomers(),
    getActiveTechnicians(),
    getDispatchJobs(100),
  ]);
  const activeJobs = jobs.filter((job) => ["scheduled", "in_progress"].includes(job.status));
  const billing = await getBillingSummary(activeJobs.map((job) => job.id));

  return <AppShell
    title="Create anything you need from one owner workspace."
    description="Customers, service calls, estimates, invoices, staff, and customer documents are grouped into one simple creation flow."
    highlight={<div className="space-y-3"><p className="text-sm uppercase tracking-[0.3em] text-[#8ffafa]">Creation Center</p><StatusPill tone="emerald">Owner tools</StatusPill><StatusPill>{activeJobs.length} active calls</StatusPill></div>}
  >
    <CreationCenter customers={customers} technicians={technicians} jobs={jobs} billing={billing} />
  </AppShell>;
}
