import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { ClockCard } from "@/components/clock-card";
import { TechnicianView } from "@/components/technician-view";
import { getCustomerProfile } from "@/lib/chillbros/customer-profile";
import { getEquipmentByCustomer } from "@/lib/chillbros/equipment-queries";
import { getInvoiceV2ByJobId, invoiceTotals } from "@/lib/chillbros/invoice-v2";
import { getDispatchJobs, getOpenTimesheet } from "@/lib/chillbros/operations-queries";
import { getPaymentSettings } from "@/lib/chillbros/payment-settings";
import { getFeeSettings, getJob, getPartsCatalog } from "@/lib/chillbros/queries";
import { getAssignedFieldJobsForTechnician } from "@/lib/chillbros/technician-assignment";
import { JOB_ACTIVE_STATUSES } from "@/lib/chillbros/types";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";

export const dynamic = "force-dynamic";
type Props = { searchParams: Promise<{ job?: string }> };
const FIELD_VISIBLE = new Set([
  "scheduled",
  "in_progress",
  "dispatched",
  "en_route",
  "arrived",
  "diagnosing",
  "awaiting_approval",
  "approved",
  "parts_required",
  "return_visit_needed",
  "repairing",
  "work_complete",
  "ready_to_invoice",
]);

export default async function TechnicianPage({ searchParams }: Props) {
  const profile = await getCurrentStaffProfile();
  if (!profile) redirect("/sign-in");
  if (!["technician", "manager"].includes(profile.role)) redirect("/dispatch");
  const isManager = profile.role === "manager";

  const allJobs = isManager
    ? await getDispatchJobs(250)
    : await getAssignedFieldJobsForTechnician({ id: profile.id, email: profile.email, fullName: profile.fullName }, 250);
  const fieldJobs = allJobs.filter((job) =>
    JOB_ACTIVE_STATUSES.includes(job.status) && FIELD_VISIBLE.has(job.status),
  );

  const params = await searchParams;
  const requestedId = fieldJobs.some((item) => item.id === params.job) ? params.job! : null;
  const managerOwnJob = isManager ? fieldJobs.find((item) => item.assignedTechId === profile.id)?.id : null;
  const selectedId = requestedId ?? managerOwnJob ?? fieldJobs[0]?.id;
  const job = selectedId ? await getJob(selectedId) : null;

  const [invoice, feeSettings, partsCatalog, equipment, customerProfile] = job
    ? await Promise.all([getInvoiceV2ByJobId(job.id), getFeeSettings(), getPartsCatalog(), getEquipmentByCustomer(job.customerId), getCustomerProfile(job.customerId).catch(() => null)])
    : [null, [], [], [], null];
  // Quick contact for the current call: phone from the customer record, directions to the job site (or the customer's address).
  const phoneDigits = (customerProfile?.customer.phone ?? "").replace(/[^\d+]/g, "");
  const callHref = phoneDigits.replace(/\D/g, "").length >= 7 ? `tel:${phoneDigits}` : null;
  const serviceAddress = job?.location?.trim() || customerProfile?.customer.address?.trim() || null;
  const directionsHref = serviceAddress ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(serviceAddress)}` : null;
  const [paymentSettings, openTimesheet] = await Promise.all([getPaymentSettings(), getOpenTimesheet(profile.id)]);
  const totals = invoice ? invoiceTotals(invoice) : null;
  const suggestedItems = job ? [
    ...feeSettings.map((fee) => ({ label: fee.label, description: "Service fee", quantity: 1, unitPrice: fee.amount })),
    ...job.parts.map((part) => ({ label: part.name, description: part.partNumber || "Inventory part", quantity: part.quantity, unitPrice: part.retailPrice })),
  ].slice(0, 20) : [];

  return <AppShell
    lead={<ClockCard open={openTimesheet ? { id: openTimesheet.id, clockInAt: openTimesheet.clockInAt, location: openTimesheet.location } : null} />}
    title={isManager ? "Field command" : "Today"}
  >
    <TechnicianView
      isManager={isManager}
      profileId={profile.id}
      fieldJobs={fieldJobs}
      selectedId={selectedId ?? null}
      job={job}
      invoice={invoice}
      totals={totals}
      partsCatalog={partsCatalog}
      equipment={equipment}
      paymentSettings={paymentSettings}
      suggestedItems={suggestedItems}
      callHref={callHref}
      directionsHref={directionsHref}
    />
  </AppShell>;
}
