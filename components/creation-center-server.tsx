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

const actionClass = "flex min-h-20 items-center justify-center gap-3 rounded-2xl border border-[#2d7dff]/30 bg-black/60 p-3 text-center active:bg-[#2d7dff]/20";
const smallActionClass = "flex min-h-11 items-center justify-center rounded-xl border border-[#2d7dff]/30 bg-black/60 px-3 py-2 text-center text-sm font-semibold text-white active:bg-[#2d7dff]/20";
const fieldClass = "min-h-11 w-full rounded-xl border border-[#2d7dff]/25 bg-black px-3 py-2 text-center text-white";

function ModeAction({ href, icon: Icon, title, helper }: { href: string; icon: typeof FilePlus2; title: string; helper: string }) {
  return <a href={href} className={actionClass}>
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#8ffafa]/30 bg-[#2d7dff]/10"><Icon className="h-5 w-5 text-[#8ffafa]" /></span>
    <span className="text-center"><span className="block text-base font-semibold text-white">{title}</span><span className="mt-0.5 block text-xs text-zinc-400">{helper}</span></span>
  </a>;
}

function JobPicker({ mode, jobs, selectedJobId }: { mode: Mode; jobs: DispatchJob[]; selectedJobId: string }) {
  return <form action="/create" method="get" className="grid gap-2 sm:grid-cols-[1fr_auto]">
    <input type="hidden" name="mode" value={mode} />
    <select name="job" defaultValue={selectedJobId} className={fieldClass}>
      <option value="">Choose service call</option>
      {jobs.map((job) => <option key={job.id} value={job.id}>{job.customerName} • {job.assignedTechName ?? "Unassigned"} • {job.scheduledWindow ?? job.status.replace(/_/g, " ")}</option>)}
    </select>
    <button type="submit" className="min-h-11 rounded-xl border border-[#8ffafa]/50 bg-[#2d7dff]/15 px-4 py-2 text-center font-semibold text-[#d9fbff]">Load</button>
  </form>;
}

function normalizeCustomer(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
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
  const visibleBilling = billing.filter((row) => !needle || `${row.customerName} ${row.invoiceNumber}`.toLowerCase().includes(needle));
  const groupedBilling = Array.from(visibleBilling.reduce((map, row) => {
    const key = normalizeCustomer(row.customerName);
    const group = map.get(key) ?? [];
    group.push(row);
    map.set(key, group);
    return map;
  }, new Map<string, CreationBillingSummary[]>()).values()).map((rows) => rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));

  return <div className="relative z-20 isolate space-y-4 text-center pointer-events-auto">
    <section className="rounded-2xl border border-[#2d7dff]/30 bg-black/45 p-3 sm:p-4">
      <div className="mb-3 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8ffafa]">Owner Document Desk</p>
        <h2 className="mt-1 text-xl font-semibold text-white">What do you need to do?</h2>
        <p className="mt-1 text-xs text-zinc-400">Billing first. Setup tools stay available below.</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <ModeAction href="/create?mode=estimate" icon={FilePlus2} title="New Estimate" helper="Build a quote" />
        <ModeAction href="/create?mode=invoice" icon={ReceiptText} title="New / Open Invoice" helper="Open billing" />
        <ModeAction href="/create?mode=document" icon={FilePenLine} title="Find / Edit" helper="Quotes and invoices" />
        <ModeAction href="/payments" icon={WalletCards} title="Record Payment" helper="Payment and receipt" />
      </div>
    </section>

    {error ? <p className="rounded-xl border border-rose-500/35 bg-rose-500/10 px-3 py-2 text-center text-sm text-rose-200">{error}</p> : null}
    {success ? <p className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-center text-sm text-emerald-200">{success}</p> : null}

    {mode === "document" ? <section className="rounded-2xl border border-[#2d7dff]/30 bg-black/45 p-3 sm:p-4">
      <div className="mb-3 text-center"><h3 className="text-xl font-semibold text-white">Find or edit a quote / invoice</h3><p className="mt-1 text-xs text-zinc-400">Customers are grouped. Tap one name to open its documents.</p></div>
      <form action="/create" method="get" className="mb-3 grid gap-2 sm:grid-cols-[1fr_auto]">
        <input type="hidden" name="mode" value="document" />
        <div className="relative"><Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" /><input name="q" defaultValue={searchTerm} placeholder="Customer or invoice number" className={`${fieldClass} pl-11`} /></div>
        <button type="submit" className="min-h-11 rounded-xl border border-[#8ffafa]/50 bg-[#2d7dff]/15 px-4 py-2 text-center font-semibold text-[#d9fbff]">Search</button>
      </form>
      <div className="space-y-2">
        {groupedBilling.length === 0 ? <p className="rounded-xl border border-[#2d7dff]/20 bg-zinc-950/70 p-3 text-center text-sm text-zinc-400">No matching documents.</p> : groupedBilling.slice(0, 30).map((rows) => {
          const latest = rows[0];
          return <details key={normalizeCustomer(latest.customerName)} className="group rounded-xl border border-[#2d7dff]/20 bg-zinc-950/75 p-2 open:p-3">
            <summary className="flex cursor-pointer list-none items-center justify-center gap-2 text-center font-semibold text-white">
              <span>{latest.customerName}</span>
              <span className="rounded-full border border-[#2d7dff]/25 px-2 py-0.5 text-[10px] font-normal text-[#d9fbff]">{rows.length} {rows.length === 1 ? "document" : "documents"}</span>
            </summary>
            <div className="mt-3 space-y-2">
              {rows.map((row) => {
                const isInvoice = row.status === "approved";
                return <article key={`${row.portalToken}-${row.updatedAt}`} className="rounded-xl border border-[#2d7dff]/15 bg-black/45 p-2 text-center">
                  <p className="text-sm font-semibold text-white">{isInvoice ? "Invoice" : "Estimate"} {row.invoiceNumber}</p>
                  <p className="mt-0.5 text-xs text-zinc-400">{row.status.replace(/_/g, " ")} • {row.paymentStatus.replace(/_/g, " ")}</p>
                  <div className="mt-2 grid grid-cols-3 gap-1.5">
                    {row.jobId ? <a href={isInvoice ? "/invoices" : `/technician?job=${encodeURIComponent(row.jobId)}`} className={smallActionClass}>{isInvoice ? "Manage" : "Edit"}</a> : <a href="/invoices" className={smallActionClass}>Manage</a>}
                    <a href={`/portal/${row.portalToken}`} target="_blank" rel="noreferrer" className={smallActionClass}>View</a>
                    <a href={`/portal/${row.portalToken}/document`} target="_blank" rel="noreferrer" className={smallActionClass}>PDF</a>
                    {isInvoice && row.paymentStatus !== "paid" ? <a href="/payments" className={`${smallActionClass} col-span-3`}>Payment</a> : null}
                  </div>
                </article>;
              })}
            </div>
          </details>;
        })}
      </div>
    </section> : null}

    {mode === "estimate" ? <section className="rounded-2xl border border-[#2d7dff]/30 bg-black/45 p-3 sm:p-4">
      <div className="mb-3 text-center"><h3 className="text-xl font-semibold text-white">New estimate</h3><p className="mt-1 text-xs text-zinc-400">Choose a service call, then build or edit the quote.</p></div>
      <JobPicker mode="estimate" jobs={activeJobs} selectedJobId={selectedJob?.id ?? ""} />
      <div className="mt-3">{!selectedJob ? <p className="text-sm text-zinc-400">No active call selected.</p> : selectedBilling ? <div className="grid grid-cols-3 gap-2"><a href={`/technician?job=${encodeURIComponent(selectedJob.id)}`} className={smallActionClass}>Edit Estimate</a><a href={`/portal/${selectedBilling.portalToken}`} target="_blank" rel="noreferrer" className={smallActionClass}>View</a><a href={`/portal/${selectedBilling.portalToken}/document`} target="_blank" rel="noreferrer" className={smallActionClass}>PDF</a></div> : <EstimateComposer jobId={selectedJob.id} suggestedItems={[]} />}</div>
    </section> : null}

    {mode === "invoice" ? <section className="rounded-2xl border border-[#2d7dff]/30 bg-black/45 p-3 sm:p-4">
      <div className="mb-3 text-center"><h3 className="text-xl font-semibold text-white">New / open invoice</h3><p className="mt-1 text-xs text-zinc-400">Choose a call. Approved quotes become invoices.</p></div>
      <JobPicker mode="invoice" jobs={activeJobs} selectedJobId={selectedJob?.id ?? ""} />
      <div className="mt-3">{!selectedJob ? <p className="text-sm text-zinc-400">No active call selected.</p> : selectedBilling ? <div className="space-y-2 rounded-xl border border-[#2d7dff]/20 bg-zinc-950/75 p-3 text-center"><p className="font-semibold text-white">{selectedBilling.status === "approved" ? "Invoice" : "Estimate"} {selectedBilling.invoiceNumber}</p><div className="grid grid-cols-4 gap-1.5"><a href={selectedBilling.status === "approved" ? "/invoices" : `/technician?job=${encodeURIComponent(selectedJob.id)}`} className={smallActionClass}>{selectedBilling.status === "approved" ? "Manage" : "Edit"}</a><a href={`/portal/${selectedBilling.portalToken}`} target="_blank" rel="noreferrer" className={smallActionClass}>View</a><a href={`/portal/${selectedBilling.portalToken}/document`} target="_blank" rel="noreferrer" className={smallActionClass}>PDF</a><a href="/payments" className={smallActionClass}>Pay</a></div></div> : <EstimateComposer jobId={selectedJob.id} suggestedItems={[]} />}</div>
    </section> : null}

    <section className="rounded-2xl border border-[#2d7dff]/20 bg-black/30 p-3 sm:p-4">
      <p className="mb-2 text-center text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Setup & operations</p>
      <div className="grid grid-cols-3 gap-2">
        <a href="/create?mode=customer" className={smallActionClass}><UserPlus className="mr-1 h-4 w-4 text-[#8ffafa]" />Customer</a>
        <a href="/create?mode=job" className={smallActionClass}><CalendarPlus className="mr-1 h-4 w-4 text-[#8ffafa]" />Service Call</a>
        <a href="/create?mode=technician" className={smallActionClass}><UsersRound className="mr-1 h-4 w-4 text-[#8ffafa]" />Staff</a>
      </div>
    </section>

    {mode === "customer" ? <section className="rounded-2xl border border-[#2d7dff]/30 bg-black/45 p-3 sm:p-4"><form action={createCustomerFromCenter} className="space-y-3"><h3 className="text-xl font-semibold text-white">Create customer</h3><div className="grid gap-2 sm:grid-cols-2"><input required name="name" placeholder="Customer / business name" className={fieldClass} /><input name="phone" placeholder="Phone" className={fieldClass} /><input name="email" type="email" placeholder="Email" className={fieldClass} /><input name="address" placeholder="Address" className={fieldClass} /></div><button type="submit" className="min-h-11 w-full rounded-xl border border-[#8ffafa]/50 bg-[#2d7dff]/15 px-3 py-2 text-center font-semibold text-[#d9fbff]">Create Customer</button></form></section> : null}

    {mode === "job" ? <section className="rounded-2xl border border-[#2d7dff]/30 bg-black/45 p-3 sm:p-4"><form action={createJobFromCenter} className="space-y-3"><h3 className="text-xl font-semibold text-white">Create service call</h3><div className="grid gap-2 sm:grid-cols-2"><select required name="customerId" defaultValue={selectedCustomerId || customers[0]?.id || ""} className={fieldClass}><option value="">Choose customer</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select><select name="assignedTechId" defaultValue="" className={fieldClass}><option value="">Unassigned</option>{technicians.map((tech) => <option key={tech.id} value={tech.id}>{tech.fullName}{tech.role === "manager" ? " • Owner/Manager" : ""}</option>)}</select><input name="location" placeholder="Job location" className={fieldClass} /><input name="scheduledWindow" placeholder="Schedule, e.g. Today 2-4 PM" className={fieldClass} /></div><textarea name="scope" rows={3} placeholder="Complaint / scope of work" className={fieldClass} /><button type="submit" className="min-h-11 w-full rounded-xl border border-[#8ffafa]/50 bg-[#2d7dff]/15 px-3 py-2 text-center font-semibold text-[#d9fbff]">Create Service Call</button></form></section> : null}

    {mode === "technician" ? <section className="rounded-2xl border border-[#2d7dff]/30 bg-black/45 p-3 sm:p-4"><form action={createStaffFromCenter} className="space-y-3"><h3 className="text-xl font-semibold text-white">Create technician / staff</h3><div className="grid gap-2 sm:grid-cols-2"><input required name="fullName" placeholder="Full name" className={fieldClass} /><input required name="email" type="email" placeholder="Email" className={fieldClass} /><select required name="role" defaultValue="technician" className={fieldClass}><option value="technician">Technician</option><option value="office">Office / Dispatch</option><option value="manager">Manager</option></select><input name="phone" placeholder="Phone" className={fieldClass} /></div><button type="submit" className="min-h-11 w-full rounded-xl border border-[#8ffafa]/50 bg-[#2d7dff]/15 px-3 py-2 text-center font-semibold text-[#d9fbff]">Create Staff Login</button></form>{tempPassword ? <div className="mt-3 rounded-xl border border-amber-300/30 bg-amber-300/10 p-3 text-center"><p className="font-semibold text-amber-100">Temporary login created</p><p className="mt-2 text-sm text-zinc-300">{tempPassword.email}</p><p className="mt-1 font-mono text-sm text-white">{tempPassword.password}</p><form action={clearCreationTempPassword} className="mt-2"><button type="submit" className="text-center text-xs text-zinc-400 underline">Clear temporary password</button></form></div> : null}</section> : null}
  </div>;
}