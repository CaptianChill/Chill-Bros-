import { CalendarPlus, FilePenLine, FilePlus2, ReceiptText, Search, UserPlus, UsersRound, WalletCards } from "lucide-react";

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
  customerName: string;
  status: "draft" | "awaiting_approval" | "approved" | "void";
  paymentStatus: "unpaid" | "pending_manual_review" | "paid";
  updatedAt: string;
};

type TempPassword = { email: string; password: string } | null;

const actionClass = "flex min-h-24 items-center gap-4 rounded-3xl border border-[#2d7dff]/30 bg-black/60 p-4 text-left active:bg-[#2d7dff]/20";
const smallActionClass = "flex min-h-14 items-center justify-center rounded-2xl border border-[#2d7dff]/30 bg-black/60 px-4 py-3 text-center text-sm font-semibold text-white active:bg-[#2d7dff]/20";
const fieldClass = "min-h-12 w-full rounded-2xl border border-[#2d7dff]/25 bg-black px-4 py-3 text-white";

function ModeAction({ href, icon: Icon, title, helper }: { href: string; icon: typeof FilePlus2; title: string; helper: string }) {
  return <a href={href} className={actionClass}>
    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#8ffafa]/30 bg-[#2d7dff]/10"><Icon className="h-6 w-6 text-[#8ffafa]" /></span>
    <span><span className="block text-lg font-semibold text-white">{title}</span><span className="mt-1 block text-sm text-zinc-400">{helper}</span></span>
  </a>;
}

function JobPicker({ mode, jobs, selectedJobId }: { mode: Mode; jobs: DispatchJob[]; selectedJobId: string }) {
  return <form action="/create" method="get" className="grid gap-2 sm:grid-cols-[1fr_auto]">
    <input type="hidden" name="mode" value={mode} />
    <select name="job" defaultValue={selectedJobId} className={fieldClass}>
      <option value="">Choose service call</option>
      {jobs.map((job) => <option key={job.id} value={job.id}>{job.customerName} • {job.assignedTechName ?? "Unassigned"} • {job.scheduledWindow ?? job.status.replace(/_/g, " ")}</option>)}
    </select>
    <button type="submit" className="min-h-12 rounded-2xl border border-[#8ffafa]/50 bg-[#2d7dff]/15 px-5 py-3 font-semibold text-[#d9fbff]">Load</button>
  </form>;
}

export function CreationCenterServer({
  mode,
  customers,
  technicians,
  jobs,
  billing,
  selectedJobId,
  selectedCustomerId,
  searchTerm,
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
  searchTerm: string;
  success?: string;
  error?: string;
  tempPassword: TempPassword;
}) {
  const activeJobs = jobs.filter((job) => ["scheduled", "in_progress"].includes(job.status));
  const selectedJob = activeJobs.find((job) => job.id === selectedJobId) ?? null;
  const selectedBilling = selectedJob ? billing.find((row) => row.jobId === selectedJob.id) ?? null : null;
  const needle = searchTerm.trim().toLowerCase();
  const visibleBilling = billing.filter((row) => !needle || `${row.customerName} ${row.invoiceNumber}`.toLowerCase().includes(needle)).slice(0, 30);

  return <div className="relative z-20 isolate space-y-5 pointer-events-auto">
    <section className="rounded-3xl border border-[#2d7dff]/30 bg-black/45 p-4 sm:p-5">
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8ffafa]">Owner Document Desk</p>
        <h2 className="mt-1 text-2xl font-semibold text-white">What do you need to do?</h2>
        <p className="mt-1 text-sm text-zinc-400">Billing first. Setup tools stay available below.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <ModeAction href="/create?mode=estimate" icon={FilePlus2} title="New Estimate" helper="Choose a call and build a quote" />
        <ModeAction href="/create?mode=invoice" icon={ReceiptText} title="New / Open Invoice" helper="Open the billing flow for a service call" />
        <ModeAction href="/create?mode=document" icon={FilePenLine} title="Find / Edit Documents" helper="Quotes, invoices, customer view and print" />
        <ModeAction href="/payments" icon={WalletCards} title="Record Payment" helper="Payment method, confirmation and receipt" />
      </div>
    </section>

    {error ? <p className="rounded-2xl border border-rose-500/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p> : null}
    {success ? <p className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{success}</p> : null}

    {mode === "document" ? <section className="rounded-3xl border border-[#2d7dff]/30 bg-black/45 p-4 sm:p-5">
      <div className="mb-4"><h3 className="text-xl font-semibold text-white">Find or edit a quote / invoice</h3><p className="mt-1 text-sm text-zinc-400">Search by customer or invoice number. Recent documents are shown automatically.</p></div>
      <form action="/create" method="get" className="mb-4 grid gap-2 sm:grid-cols-[1fr_auto]">
        <input type="hidden" name="mode" value="document" />
        <div className="relative"><Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" /><input name="q" defaultValue={searchTerm} placeholder="Customer or invoice number" className={`${fieldClass} pl-11`} /></div>
        <button type="submit" className="min-h-12 rounded-2xl border border-[#8ffafa]/50 bg-[#2d7dff]/15 px-5 py-3 font-semibold text-[#d9fbff]">Search</button>
      </form>
      <div className="space-y-3">
        {visibleBilling.length === 0 ? <p className="rounded-2xl border border-[#2d7dff]/20 bg-zinc-950/70 p-4 text-sm text-zinc-400">No matching documents.</p> : visibleBilling.map((row) => {
          const isInvoice = row.status === "approved";
          return <article key={`${row.portalToken}-${row.updatedAt}`} className="rounded-2xl border border-[#2d7dff]/20 bg-zinc-950/75 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div><p className="font-semibold text-white">{row.customerName}</p><p className="mt-1 text-sm text-zinc-400">{isInvoice ? "Invoice" : "Estimate"} {row.invoiceNumber} • {row.status.replace(/_/g, " ")}</p></div>
              <span className="rounded-full border border-[#2d7dff]/25 px-2.5 py-1 text-xs text-[#d9fbff]">{row.paymentStatus.replace(/_/g, " ")}</span>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {row.jobId ? <a href={isInvoice ? "/invoices" : `/technician?job=${encodeURIComponent(row.jobId)}`} className={smallActionClass}>{isInvoice ? "Manage Invoice" : "Edit Estimate"}</a> : <a href="/invoices" className={smallActionClass}>Manage</a>}
              <a href={`/portal/${row.portalToken}`} target="_blank" rel="noreferrer" className={smallActionClass}>Customer View</a>
              <a href={`/portal/${row.portalToken}/document`} target="_blank" rel="noreferrer" className={smallActionClass}>Print / PDF</a>
              {isInvoice && row.paymentStatus !== "paid" ? <a href="/payments" className={smallActionClass}>Payment</a> : null}
            </div>
          </article>;
        })}
      </div>
    </section> : null}

    {mode === "estimate" ? <section className="rounded-3xl border border-[#2d7dff]/30 bg-black/45 p-4 sm:p-5">
      <div className="mb-4"><h3 className="text-xl font-semibold text-white">New estimate</h3><p className="mt-1 text-sm text-zinc-400">1. Choose the service call. 2. Build or edit the quote.</p></div>
      <JobPicker mode="estimate" jobs={activeJobs} selectedJobId={selectedJob?.id ?? ""} />
      <div className="mt-4">{!selectedJob ? <p className="text-sm text-zinc-400">No active call selected. Create a service call below if needed.</p> : selectedBilling ? <div className="grid gap-2 sm:grid-cols-3"><a href={`/technician?job=${encodeURIComponent(selectedJob.id)}`} className={smallActionClass}>Edit Existing Estimate</a><a href={`/portal/${selectedBilling.portalToken}`} target="_blank" rel="noreferrer" className={smallActionClass}>Customer View</a><a href={`/portal/${selectedBilling.portalToken}/document`} target="_blank" rel="noreferrer" className={smallActionClass}>Print / PDF</a></div> : <EstimateComposer jobId={selectedJob.id} suggestedItems={[]} />}</div>
    </section> : null}

    {mode === "invoice" ? <section className="rounded-3xl border border-[#2d7dff]/30 bg-black/45 p-4 sm:p-5">
      <div className="mb-4"><h3 className="text-xl font-semibold text-white">New / open invoice</h3><p className="mt-1 text-sm text-zinc-400">Choose a call. If a quote exists, open it. Approved quotes become invoices.</p></div>
      <JobPicker mode="invoice" jobs={activeJobs} selectedJobId={selectedJob?.id ?? ""} />
      <div className="mt-4">{!selectedJob ? <p className="text-sm text-zinc-400">No active call selected.</p> : selectedBilling ? <div className="space-y-3 rounded-2xl border border-[#2d7dff]/20 bg-zinc-950/75 p-4"><p className="font-semibold text-white">{selectedBilling.status === "approved" ? "Invoice" : "Estimate"} {selectedBilling.invoiceNumber}</p><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><a href={selectedBilling.status === "approved" ? "/invoices" : `/technician?job=${encodeURIComponent(selectedJob.id)}`} className={smallActionClass}>{selectedBilling.status === "approved" ? "Manage Invoice" : "Edit Quote"}</a><a href={`/portal/${selectedBilling.portalToken}`} target="_blank" rel="noreferrer" className={smallActionClass}>Customer View</a><a href={`/portal/${selectedBilling.portalToken}/document`} target="_blank" rel="noreferrer" className={smallActionClass}>Print / PDF</a><a href="/payments" className={smallActionClass}>Payment</a></div></div> : <EstimateComposer jobId={selectedJob.id} suggestedItems={[]} />}</div>
    </section> : null}

    <section className="rounded-3xl border border-[#2d7dff]/20 bg-black/30 p-4 sm:p-5">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Setup & operations</p>
      <div className="grid gap-2 sm:grid-cols-3">
        <a href="/create?mode=customer" className={smallActionClass}><UserPlus className="mr-2 h-4 w-4 text-[#8ffafa]" />New Customer</a>
        <a href="/create?mode=job" className={smallActionClass}><CalendarPlus className="mr-2 h-4 w-4 text-[#8ffafa]" />New Service Call</a>
        <a href="/create?mode=technician" className={smallActionClass}><UsersRound className="mr-2 h-4 w-4 text-[#8ffafa]" />New Staff</a>
      </div>
    </section>

    {mode === "customer" ? <section className="rounded-3xl border border-[#2d7dff]/30 bg-black/45 p-4 sm:p-5"><form action={createCustomerFromCenter} className="space-y-4"><h3 className="text-xl font-semibold text-white">Create customer</h3><div className="grid gap-3 sm:grid-cols-2"><input required name="name" placeholder="Customer / business name" className={fieldClass} /><input name="phone" placeholder="Phone" className={fieldClass} /><input name="email" type="email" placeholder="Email" className={fieldClass} /><input name="address" placeholder="Address" className={fieldClass} /></div><button type="submit" className="min-h-12 w-full rounded-2xl border border-[#8ffafa]/50 bg-[#2d7dff]/15 px-4 py-3 font-semibold text-[#d9fbff]">Create Customer</button></form></section> : null}

    {mode === "job" ? <section className="rounded-3xl border border-[#2d7dff]/30 bg-black/45 p-4 sm:p-5"><form action={createJobFromCenter} className="space-y-4"><h3 className="text-xl font-semibold text-white">Create service call</h3><div className="grid gap-3 sm:grid-cols-2"><select required name="customerId" defaultValue={selectedCustomerId || customers[0]?.id || ""} className={fieldClass}><option value="">Choose customer</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select><select name="assignedTechId" defaultValue="" className={fieldClass}><option value="">Unassigned</option>{technicians.map((tech) => <option key={tech.id} value={tech.id}>{tech.fullName}{tech.role === "manager" ? " • Owner/Manager" : ""}</option>)}</select><input name="location" placeholder="Job location" className={fieldClass} /><input name="scheduledWindow" placeholder="Schedule, e.g. Today 2-4 PM" className={fieldClass} /></div><textarea name="scope" rows={4} placeholder="Complaint / scope of work" className={fieldClass} /><button type="submit" className="min-h-12 w-full rounded-2xl border border-[#8ffafa]/50 bg-[#2d7dff]/15 px-4 py-3 font-semibold text-[#d9fbff]">Create Service Call</button></form></section> : null}

    {mode === "technician" ? <section className="rounded-3xl border border-[#2d7dff]/30 bg-black/45 p-4 sm:p-5"><form action={createStaffFromCenter} className="space-y-4"><h3 className="text-xl font-semibold text-white">Create technician / staff</h3><div className="grid gap-3 sm:grid-cols-2"><input required name="fullName" placeholder="Full name" className={fieldClass} /><input required name="email" type="email" placeholder="Email" className={fieldClass} /><select required name="role" defaultValue="technician" className={fieldClass}><option value="technician">Technician</option><option value="office">Office / Dispatch</option><option value="manager">Manager</option></select><input name="phone" placeholder="Phone" className={fieldClass} /></div><button type="submit" className="min-h-12 w-full rounded-2xl border border-[#8ffafa]/50 bg-[#2d7dff]/15 px-4 py-3 font-semibold text-[#d9fbff]">Create Staff Login</button></form>{tempPassword ? <div className="mt-4 rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4"><p className="font-semibold text-amber-100">Temporary login created</p><p className="mt-2 text-sm text-zinc-300">{tempPassword.email}</p><p className="mt-1 font-mono text-sm text-white">{tempPassword.password}</p><form action={clearCreationTempPassword} className="mt-3"><button type="submit" className="text-xs text-zinc-400 underline">Clear temporary password</button></form></div> : null}</section> : null}
  </div>;
}
