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
type Props = { searchParams: Promise<{ mode?: string; job?: string; customer?: string; q?: string; success?: string; error?: string }> };
const MODES = new Set<Mode>(["customer", "job", "estimate", "invoice", "technician", "document"]);

async function getBillingSummary(): Promise<CreationBillingSummary[]> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("chillbros_invoices")
    .select("job_id,invoice_number,portal_token,status,payment_status,updated_at,customer:chillbros_customers(name)")
    .is("revoked_at", null)
    .neq("status", "void")
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error || !data) return [];

  return data.map((row) => {
    const customer = Array.isArray(row.customer) ? row.customer[0] : row.customer;
    return {
      jobId: row.job_id ?? "",
      invoiceNumber: row.invoice_number,
      portalToken: row.portal_token,
      customerName: customer?.name ?? "Customer",
      status: row.status as CreationBillingSummary["status"],
      paymentStatus: row.payment_status as CreationBillingSummary["paymentStatus"],
      updatedAt: row.updated_at,
    };
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
  const mode = MODES.has(params.mode as Mode) ? params.mode as Mode : "document";
  if (mode === "estimate") redirect("/invoices/new?type=quote");
  if (mode === "invoice") redirect("/invoices/new?type=invoice");

  const [customers, technicians, jobs, billing] = await Promise.all([
    getCustomers(),
    getActiveTechnicians(),
    getDispatchJobs(100),
    getBillingSummary(),
  ]);
  const activeJobs = jobs.filter((job) => ["scheduled", "in_progress"].includes(job.status));
  const selectedJobId = activeJobs.some((job) => job.id === params.job) ? params.job! : activeJobs[0]?.id ?? "";
  const selectedCustomerId = customers.some((customer) => customer.id === params.customer) ? params.customer! : customers[0]?.id ?? "";
  const store = await cookies();
  const tempPassword = readTempPassword(store.get("chillbros_creation_temp")?.value);

  return <AppShell title="Owner Document Desk">
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <StatusPill tone="emerald">Owner Document Desk</StatusPill>
      <StatusPill>{billing.length} recent billing docs</StatusPill>
      <StatusPill>{activeJobs.length} active calls</StatusPill>
    </div>
    <CreationCenterServer
      mode={mode}
      customers={customers}
      technicians={technicians}
      jobs={jobs}
      billing={billing}
      selectedJobId={selectedJobId}
      selectedCustomerId={selectedCustomerId}
      searchTerm={params.q ?? ""}
      success={params.success}
      error={params.error}
      tempPassword={tempPassword}
    />
  </AppShell>;
}
