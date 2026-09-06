import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { CreationCenterServer, type CreationBillingSummary } from "@/components/creation-center-server";
import { StatusPill } from "@/components/status-pill";
import { getActiveTechnicians, getDispatchJobs } from "@/lib/chillbros/operations-queries";
import { getCustomers } from "@/lib/chillbros/queries";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import { createServiceRoleClient } from "@/lib/supabase/service-client";

export const dynamic = "force-dynamic";

type Mode = "customer" | "job" | "estimate" | "invoice" | "technician" | "document";
type Props = { searchParams: Promise<{ mode?: string; job?: string; customer?: string; success?: string; error?: string }> };
const MODES = new Set<Mode>(["customer", "job", "estimate", "invoice", "technician", "document"]);

async function getBillingSummary(jobIds: string[]): Promise<CreationBillingSummary[]> {
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
      status: row.status as CreationBillingSummary["status"],
      paymentStatus: row.payment_status as CreationBillingSummary["paymentStatus"],
    }];
  });
}

function readTempPassword(raw: string | undefined) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { email?: unknown; password?: unknown };
    if (typeof parsed.email === "string" && typeof parsed.password === "string") return { email: parsed.email, password: parsed.password };
  } catch {
    // Invalid or expired flash data is ignored.
  }
  return null;
}

export default async function CreatePage({ searchParams }: Props) {
  const profile = await getCurrentStaffProfile();
  if (!profile) redirect("/sign-in");
  if (profile.role !== "manager") redirect("/");

  const params = await searchParams;
  const mode = MODES.has(params.mode as Mode) ? params.mode as Mode : "job";
  const [customers, technicians, jobs] = await Promise.all([
    getCustomers(),
    getActiveTechnicians(),
    getDispatchJobs(100),
  ]);
  const activeJobs = jobs.filter((job) => ["scheduled", "in_progress"].includes(job.status));
  const billing = await getBillingSummary(activeJobs.map((job) => job.id));
  const selectedJobId = activeJobs.some((job) => job.id === params.job) ? params.job! : activeJobs[0]?.id ?? "";
  const selectedCustomerId = customers.some((customer) => customer.id === params.customer) ? params.customer! : customers[0]?.id ?? "";
  const store = await cookies();
  const tempPassword = readTempPassword(store.get("chillbros_creation_temp")?.value);

  return <AppShell
    title="Create anything you need from one owner workspace."
    description="Customers, service calls, estimates, invoices, staff, payment intake, and customer documents are grouped into one simple creation flow."
    highlight={<div className="space-y-3"><p className="text-sm uppercase tracking-[0.3em] text-[#8ffafa]">Creation Center</p><StatusPill tone="emerald">Owner tools</StatusPill><StatusPill>{activeJobs.length} active calls</StatusPill></div>}
  >
    <div className="mb-5 grid gap-3 sm:grid-cols-2">
      <Link href="/payments" className="min-h-20 rounded-3xl border border-emerald-400/30 bg-emerald-500/5 p-4 transition hover:bg-emerald-500/10">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">Billing & Documents</p>
        <p className="mt-1 text-lg font-semibold text-white">Payment Center</p>
        <p className="mt-1 text-sm text-zinc-400">Record full payments, method, confirmation details, and generate receipts.</p>
      </Link>
      <Link href="/invoices" className="min-h-20 rounded-3xl border border-[#2d7dff]/25 bg-black/35 p-4 transition hover:bg-[#2d7dff]/10">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8ffafa]">Billing & Documents</p>
        <p className="mt-1 text-lg font-semibold text-white">Invoice Center</p>
        <p className="mt-1 text-sm text-zinc-400">Open, send, adjust, review, and manage invoice status.</p>
      </Link>
    </div>
    <CreationCenterServer
      mode={mode}
      customers={customers}
      technicians={technicians}
      jobs={jobs}
      billing={billing}
      selectedJobId={selectedJobId}
      selectedCustomerId={selectedCustomerId}
      success={params.success}
      error={params.error}
      tempPassword={tempPassword}
    />
  </AppShell>;
}
