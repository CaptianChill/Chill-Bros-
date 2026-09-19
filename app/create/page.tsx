import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Box, ExternalLink, Images } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { CreationCenterServer, type CreationBillingSummary } from "@/components/creation-center-server";
import { OpenFormDrafts } from "@/components/open-form-drafts";
import { StatusPill } from "@/components/status-pill";
import { getActiveTechnicians, getDispatchJobs } from "@/lib/chillbros/operations-queries";
import { getCustomers } from "@/lib/chillbros/queries";
import { JOB_ACTIVE_STATUSES } from "@/lib/chillbros/types";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import { createServiceRoleClient } from "@/lib/supabase/service-client";

export const dynamic = "force-dynamic";

const CHILL_PRO_MADE_URL = "https://chill-pro-made.vercel.app";

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
  const [customers, technicians, jobs, billing] = await Promise.all([
    getCustomers(),
    getActiveTechnicians(),
    getDispatchJobs(100),
    getBillingSummary(),
  ]);
  const activeJobs = jobs.filter((job) => JOB_ACTIVE_STATUSES.includes(job.status));
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

    <section className="mb-4 rounded-2xl border border-[#2d7dff]/25 bg-black/30 p-3 sm:p-4">
      <div className="mb-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8ffafa]/70">Project creation</p>
        <h2 className="mt-1 text-lg font-semibold text-white">3D & visual tools</h2>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <Link href="/3d-studio" className="flex min-h-12 items-center gap-3 rounded-xl border border-[#2d7dff]/20 bg-black/35 px-3 py-2.5 text-sm font-semibold text-white transition hover:border-[#8ffafa]/55 hover:bg-[#2d7dff]/10">
          <Box className="h-4 w-4 shrink-0 text-[#8ffafa]" />
          <span>3D Studio</span>
        </Link>
        <Link href="/3d-project-builder" className="flex min-h-12 items-center gap-3 rounded-xl border border-[#2d7dff]/20 bg-black/35 px-3 py-2.5 text-sm font-semibold text-white transition hover:border-[#8ffafa]/55 hover:bg-[#2d7dff]/10">
          <Images className="h-4 w-4 shrink-0 text-[#8ffafa]" />
          <span>3D Project Builder</span>
        </Link>
        <a href={CHILL_PRO_MADE_URL} target="_blank" rel="noreferrer" className="flex min-h-12 items-center gap-3 rounded-xl border border-[#8ffafa]/35 bg-[#8ffafa]/5 px-3 py-2.5 text-sm font-semibold text-white transition hover:border-[#8ffafa]/65 hover:bg-[#8ffafa]/10">
          <ExternalLink className="h-4 w-4 shrink-0 text-[#8ffafa]" />
          <span>Chill Pro Made 3D</span>
        </a>
      </div>
    </section>

    <details className="mb-4 rounded-2xl border border-[#2d7dff]/20 bg-black/30 p-3 text-left">
      <summary className="cursor-pointer text-sm font-semibold text-[#d9fbff]">Resume a saved draft</summary>
      <div className="mt-3"><OpenFormDrafts profileId={profile.id} /></div>
    </details>

    <CreationCenterServer
      mode={mode}
      profileId={profile.id}
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
