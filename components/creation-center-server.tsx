import Link from "next/link";
import { BriefcaseBusiness, CalendarPlus, FilePlus2, FileText, ReceiptText, UserPlus, UsersRound } from "lucide-react";

import { EstimateComposer } from "@/components/estimate-composer";
import {
  clearCreationTempPassword,
  createCustomerFromCenter,
  createJobFromCenter,
  createStaffFromCenter,
} from "@/app/create/actions";
import type { Customer } from "@/lib/chillbros/types";
import type { ActiveTechnician, DispatchJob } from "@/lib/chillbros/operations-queries";

type Mode = "customer" | "job" | "estimate" | "invoice" | "technician" | "document";

export type CreationBillingSummary = {
  jobId: string;
  invoiceNumber: string;
  portalToken: string;
  status: "draft" | "awaiting_approval" | "approved" | "void";
  paymentStatus: "unpaid" | "pending_manual_review" | "paid";
};

type TempPassword = { email: string; password: string } | null;

const GROUPS: Array<{ label: string; items: Array<{ mode: Mode; label: string; helper: string }> }> = [
  {
    label: "Operations",
    items: [
      { mode: "customer", label: "Customer", helper: "Add a new customer or business" },
      { mode: "job", label: "Service Call", helper: "Create, schedule and assign a call" },
    ],
  },
  {
    label: "Billing & Documents",
    items: [
      { mode: "estimate", label: "Estimate", helper: "Build a new customer quote" },
      { mode: "invoice", label: "Invoice", helper: "Start or open the billing workflow" },
      { mode: "document", label: "Document", helper: "Open printable customer documents" },
    ],
  },
  {
    label: "Team",
    items: [
      { mode: "technician", label: "Technician / Staff", helper: "Create a staff login" },
    ],
  },
];

const ICONS = {
  customer: UserPlus,
  job: CalendarPlus,
  estimate: FilePlus2,
  invoice: ReceiptText,
  technician: UsersRound,
  document: FileText,
} satisfies Record<Mode, typeof UserPlus>;

function JobPicker({ mode, jobs, selectedJobId }: { mode: Mode; jobs: DispatchJob[]; selectedJobId: string }) {
  return (
    <form action="/create" method="get" className="grid gap-2 sm:grid-cols-[1fr_auto]">
      <input type="hidden" name="mode" value={mode} />
      <select name="job" defaultValue={selectedJobId} className="min-h-12 w-full rounded-2xl border border-[#2d7dff]/25 bg-black px-4 py-3 text-white">
        <option value="">Choose active call</option>
        {jobs.map((job) => (
          <option key={job.id} value={job.id}>
            {job.customerName} • {job.assignedTechName ?? "Unassigned"} • {job.scheduledWindow ?? job.status.replace(/_/g, " ")}
          </option>
        ))}
      </select>
      <button type="submit" className="min-h-12 rounded-2xl border border-[#2d7dff]/40 bg-[#2d7dff]/10 px-4 py-3 text-sm font-medium text-[#d9fbff]">
        Load call
      </button>
    </form>
  );
}

export function CreationCenterServer({
  mode,
  customers,
  technicians,
  jobs,
  billing,
  selectedJobId,
  selectedCustomerId,
  success,
  error,
  tempPassword,
}: {
  mode: Mode;
  customers: Customer[];
  technicians: ActiveTechnician[];
  jobs: DispatchJob[];
  billing: CreationBillingSummary[];
  selectedJobId: string;
  selectedCustomerId: string;
  success?: string;
  error?: string;
  tempPassword: TempPassword;
}) {
  const activeJobs = jobs.filter((job) => ["scheduled", "in_progress"].includes(job.status));
  const selectedJob = activeJobs.find((job) => job.id === selectedJobId) ?? activeJobs[0] ?? null;
  const selectedBilling = selectedJob ? billing.find((row) => row.jobId === selectedJob.id) ?? null : null;

  return (
    <div className="relative z-20 isolate space-y-5 pointer-events-auto">
      <section className="rounded-3xl border border-[#2d7dff]/25 bg-black/35 p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-2xl border border-[#2d7dff]/30 bg-[#2d7dff]/10 p-2.5"><BriefcaseBusiness className="h-5 w-5 text-[#8ffafa]" /></div>
          <div><h2 className="text-lg font-semibold text-white">Quick Create</h2><p className="text-sm text-zinc-400">Tap one option. It opens as a real page state, not a JavaScript-only toggle.</p></div>
        </div>
        <div className="space-y-4">
          {GROUPS.map((group) => (
            <div key={group.label}>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">{group.label}</p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {group.items.map((item) => {
                  const Icon = ICONS[item.mode];
                  const active = mode === item.mode;
                  return (
                    <Link
                      key={item.mode}
                      href={`/create?mode=${item.mode}`}
                      prefetch={false}
                      className={`relative z-30 flex min-h-20 touch-manipulation items-center gap-3 rounded-2xl border p-3 text-left ${active ? "border-[#8ffafa]/70 bg-[#2d7dff]/15 shadow-[0_0_18px_rgba(45,125,255,0.18)]" : "border-[#2d7dff]/18 bg-zinc-950/60"}`}
                    >
                      <span className="rounded-xl border border-[#2d7dff]/20 bg-black/60 p-2"><Icon className="h-4 w-4 text-[#8ffafa]" /></span>
                      <span><span className="block font-medium text-white">{item.label}</span><span className="mt-0.5 block text-xs text-zinc-500">{item.helper}</span></span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      {error ? <p className="rounded-2xl border border-rose-500/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p> : null}
      {success ? <p className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{success}</p> : null}

      <section className="rounded-3xl border border-[#2d7dff]/25 bg-black/35 p-4 sm:p-5">
        {mode === "customer" ? (
          <form action={createCustomerFromCenter} className="space-y-4">
            <div><h3 className="text-xl font-semibold text-white">Create customer</h3><p className="mt-1 text-sm text-zinc-400">Create the customer once, then use the record everywhere.</p></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <input required name="name" placeholder="Customer / business name" className="min-h-12 rounded-2xl border border-[#2d7dff]/25 bg-black px-4 py-3 text-white" />
              <input name="phone" placeholder="Phone" className="min-h-12 rounded-2xl border border-[#2d7dff]/25 bg-black px-4 py-3 text-white" />
              <input name="email" type="email" placeholder="Email" className="min-h-12 rounded-2xl border border-[#2d7dff]/25 bg-black px-4 py-3 text-white" />
              <input name="address" placeholder="Address" className="min-h-12 rounded-2xl border border-[#2d7dff]/25 bg-black px-4 py-3 text-white" />
            </div>
            <button type="submit" className="relative z-30 min-h-12 w-full touch-manipulation rounded-2xl border border-[#2d7dff] bg-[#2d7dff]/10 px-4 py-3 font-medium text-[#d9fbff]">Create customer</button>
          </form>
        ) : null}

        {mode === "job" ? (
          <form action={createJobFromCenter} className="space-y-4">
            <div><h3 className="text-xl font-semibold text-white">Create service call</h3><p className="mt-1 text-sm text-zinc-400">Create, schedule and assign the call. Your manager account is assignable too.</p></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <select required name="customerId" defaultValue={selectedCustomerId || customers[0]?.id || ""} className="min-h-12 rounded-2xl border border-[#2d7dff]/25 bg-black px-4 py-3 text-white">
                <option value="">Choose customer</option>
                {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
              </select>
              <select name="assignedTechId" defaultValue="" className="min-h-12 rounded-2xl border border-[#2d7dff]/25 bg-black px-4 py-3 text-white">
                <option value="">Unassigned</option>
                {technicians.map((tech) => <option key={tech.id} value={tech.id}>{tech.fullName}{tech.role === "manager" ? " • Owner/Manager" : ""}</option>)}
              </select>
              <input name="location" placeholder="Job location" className="min-h-12 rounded-2xl border border-[#2d7dff]/25 bg-black px-4 py-3 text-white" />
              <input name="scheduledWindow" placeholder="Schedule, e.g. Today 2-4 PM" className="min-h-12 rounded-2xl border border-[#2d7dff]/25 bg-black px-4 py-3 text-white" />
            </div>
            <textarea name="scope" rows={4} placeholder="Complaint / scope of work" className="w-full rounded-2xl border border-[#2d7dff]/25 bg-black px-4 py-3 text-white" />
            <button type="submit" className="relative z-30 min-h-12 w-full touch-manipulation rounded-2xl border border-[#2d7dff] bg-[#2d7dff]/10 px-4 py-3 font-medium text-[#d9fbff]">Create service call</button>
          </form>
        ) : null}

        {mode === "estimate" ? (
          <div className="space-y-4">
            <div><h3 className="text-xl font-semibold text-white">Create estimate</h3><p className="mt-1 text-sm text-zinc-400">Choose the service call, then build the quote below.</p></div>
            <JobPicker mode="estimate" jobs={activeJobs} selectedJobId={selectedJob?.id ?? ""} />
            {!selectedJob ? <p className="rounded-2xl border border-[#2d7dff]/15 bg-zinc-950/60 p-4 text-sm text-zinc-400">Create a service call first.</p> : selectedBilling ? (
              <div className="space-y-3 rounded-2xl border border-[#2d7dff]/20 bg-zinc-950/70 p-4">
                <p className="font-medium text-white">Billing document already exists: {selectedBilling.invoiceNumber}</p>
                <p className="text-sm text-zinc-400">Status: {selectedBilling.status.replace(/_/g, " ")}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Link href={`/technician?job=${selectedJob.id}`} className="min-h-12 rounded-xl border border-[#2d7dff]/25 px-4 py-3 text-center text-sm text-[#d9fbff]">Open / revise estimate</Link>
                  <Link href={`/portal/${selectedBilling.portalToken}`} target="_blank" className="min-h-12 rounded-xl border border-[#2d7dff]/25 px-4 py-3 text-center text-sm text-white">Customer view</Link>
                </div>
              </div>
            ) : <EstimateComposer jobId={selectedJob.id} suggestedItems={[]} />}
          </div>
        ) : null}

        {mode === "invoice" ? (
          <div className="space-y-4">
            <div><h3 className="text-xl font-semibold text-white">Create / open invoice</h3><p className="mt-1 text-sm text-zinc-400">The approved estimate becomes the invoice so the signed audit trail stays intact.</p></div>
            <JobPicker mode="invoice" jobs={activeJobs} selectedJobId={selectedJob?.id ?? ""} />
            {!selectedJob ? <p className="text-sm text-zinc-400">Create a service call first.</p> : selectedBilling ? (
              <div className="space-y-3 rounded-2xl border border-[#2d7dff]/20 bg-zinc-950/70 p-4">
                <p className="font-medium text-white">{selectedBilling.status === "approved" ? "Invoice" : "Estimate"} {selectedBilling.invoiceNumber}</p>
                <p className="text-sm text-zinc-400">Status: {selectedBilling.status.replace(/_/g, " ")} • Payment: {selectedBilling.paymentStatus.replace(/_/g, " ")}</p>
                <div className="grid gap-2 sm:grid-cols-3">
                  <Link href={`/portal/${selectedBilling.portalToken}`} target="_blank" className="min-h-12 rounded-xl border border-[#2d7dff]/25 px-4 py-3 text-center text-sm text-white">Customer view</Link>
                  <Link href={`/portal/${selectedBilling.portalToken}/document`} target="_blank" className="min-h-12 rounded-xl border border-[#2d7dff]/25 px-4 py-3 text-center text-sm text-white">Document</Link>
                  <Link href="/invoices" className="min-h-12 rounded-xl border border-[#2d7dff]/25 px-4 py-3 text-center text-sm text-[#d9fbff]">Invoice Center</Link>
                </div>
              </div>
            ) : <EstimateComposer jobId={selectedJob.id} suggestedItems={[]} />}
          </div>
        ) : null}

        {mode === "document" ? (
          <div className="space-y-4">
            <div><h3 className="text-xl font-semibold text-white">Customer documents</h3><p className="mt-1 text-sm text-zinc-400">Choose a call to open its printable estimate or invoice, or jump to the other document families.</p></div>
            <JobPicker mode="document" jobs={activeJobs} selectedJobId={selectedJob?.id ?? ""} />
            {selectedBilling ? (
              <div className="grid gap-2 sm:grid-cols-2">
                <Link href={`/portal/${selectedBilling.portalToken}/document`} target="_blank" className="min-h-12 rounded-2xl border border-[#2d7dff]/25 px-4 py-3 text-center text-sm text-[#d9fbff]">Open estimate / invoice document</Link>
                <Link href={`/portal/${selectedBilling.portalToken}`} target="_blank" className="min-h-12 rounded-2xl border border-[#2d7dff]/25 px-4 py-3 text-center text-sm text-white">Open customer portal</Link>
              </div>
            ) : <p className="rounded-2xl border border-[#2d7dff]/15 bg-zinc-950/60 p-4 text-sm text-zinc-400">This active call does not have a billing document yet.</p>}
            <div className="grid gap-2 sm:grid-cols-3">
              <Link href="/agreements" className="min-h-12 rounded-2xl border border-[#2d7dff]/25 px-4 py-3 text-center text-sm text-white">Monthly agreements</Link>
              <Link href="/customers" className="min-h-12 rounded-2xl border border-[#2d7dff]/25 px-4 py-3 text-center text-sm text-white">Customer records</Link>
              <Link href="/invoices" className="min-h-12 rounded-2xl border border-[#2d7dff]/25 px-4 py-3 text-center text-sm text-white">Invoice documents</Link>
            </div>
          </div>
        ) : null}

        {mode === "technician" ? (
          <div className="space-y-4">
            <form action={createStaffFromCenter} className="space-y-4">
              <div><h3 className="text-xl font-semibold text-white">Create technician / staff</h3><p className="mt-1 text-sm text-zinc-400">Creates a real staff login and generates a one-time temporary password.</p></div>
              <div className="grid gap-3 sm:grid-cols-3">
                <input required name="name" placeholder="Full name" className="min-h-12 rounded-2xl border border-[#2d7dff]/25 bg-black px-4 py-3 text-white" />
                <input required name="email" type="email" placeholder="Login email" className="min-h-12 rounded-2xl border border-[#2d7dff]/25 bg-black px-4 py-3 text-white" />
                <select name="role" defaultValue="technician" className="min-h-12 rounded-2xl border border-[#2d7dff]/25 bg-black px-4 py-3 text-white"><option value="technician">Technician</option><option value="office">Office / Dispatch</option><option value="manager">Manager</option></select>
              </div>
              <button type="submit" className="relative z-30 min-h-12 w-full touch-manipulation rounded-2xl border border-[#2d7dff] bg-[#2d7dff]/10 px-4 py-3 font-medium text-[#d9fbff]">Create staff login</button>
            </form>
            {tempPassword ? (
              <div className="rounded-2xl border border-[#8ffafa]/50 bg-[#2d7dff]/10 p-4">
                <p className="text-sm font-medium text-white">Temporary password for {tempPassword.email}</p>
                <p className="mt-2 break-all font-mono text-lg text-[#bafcfc]">{tempPassword.password}</p>
                <p className="mt-2 text-xs text-zinc-400">Copy it now. This notice expires automatically.</p>
                <form action={clearCreationTempPassword} className="mt-3"><button type="submit" className="rounded-xl border border-[#2d7dff]/25 px-3 py-2 text-xs text-white">Dismiss</button></form>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
