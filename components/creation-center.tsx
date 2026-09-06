"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BriefcaseBusiness, CalendarPlus, FilePlus2, FileText, ReceiptText, UserPlus, UsersRound } from "lucide-react";

import { EstimateComposer } from "@/components/estimate-composer";
import { addStaffAccountAction } from "@/lib/chillbros/mutations";
import { createCustomerAction, createJobAction } from "@/lib/chillbros/operations";
import type { Customer, StaffRole } from "@/lib/chillbros/types";
import type { ActiveTechnician, DispatchJob } from "@/lib/chillbros/operations-queries";

type Mode = "customer" | "job" | "estimate" | "invoice" | "technician" | "document";

type BillingSummary = {
  jobId: string;
  invoiceNumber: string;
  portalToken: string;
  status: "draft" | "awaiting_approval" | "approved" | "void";
  paymentStatus: "unpaid" | "pending_manual_review" | "paid";
};

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

const ICONS: Record<Mode, typeof UserPlus> = {
  customer: UserPlus,
  job: CalendarPlus,
  estimate: FilePlus2,
  invoice: ReceiptText,
  technician: UsersRound,
  document: FileText,
};

export function CreationCenter({
  customers,
  technicians,
  jobs,
  billing,
}: {
  customers: Customer[];
  technicians: ActiveTechnician[];
  jobs: DispatchJob[];
  billing: BillingSummary[];
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("job");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [newCustomerId, setNewCustomerId] = useState<string | null>(null);
  const [customerForm, setCustomerForm] = useState({ name: "", phone: "", email: "", address: "" });
  const [jobForm, setJobForm] = useState({ customerId: customers[0]?.id ?? "", assignedTechId: "", location: "", scheduledWindow: "", scope: "" });
  const [staffForm, setStaffForm] = useState<{ name: string; email: string; role: StaffRole }>({ name: "", email: "", role: "technician" });
  const [tempPassword, setTempPassword] = useState<{ email: string; password: string } | null>(null);
  const [selectedJobId, setSelectedJobId] = useState(jobs[0]?.id ?? "");

  const activeJobs = useMemo(() => jobs.filter((job) => ["scheduled", "in_progress"].includes(job.status)), [jobs]);
  const selectedJob = activeJobs.find((job) => job.id === selectedJobId) ?? activeJobs[0] ?? null;
  const selectedBilling = selectedJob ? billing.find((row) => row.jobId === selectedJob.id) ?? null : null;

  const run = (fn: () => Promise<{ ok: boolean; error?: string; data?: unknown }>, success: string, after?: (result: any) => void) => {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) {
        setError(result.error ?? "Action failed.");
        return;
      }
      after?.(result);
      setMessage(success);
      router.refresh();
    });
  };

  const createCustomer = () => run(
    () => createCustomerAction(customerForm),
    "Customer created.",
    (result) => {
      const id = result.data?.customerId as string | undefined;
      if (id) {
        setNewCustomerId(id);
        setJobForm((current) => ({ ...current, customerId: id }));
      }
      setCustomerForm({ name: "", phone: "", email: "", address: "" });
    },
  );

  const createJob = () => run(
    () => createJobAction({ ...jobForm, assignedTechId: jobForm.assignedTechId || null }),
    "Service call created.",
    (result) => {
      const id = result.data?.jobId as string | undefined;
      if (id) setSelectedJobId(id);
      setJobForm((current) => ({ ...current, location: "", scheduledWindow: "", scope: "" }));
    },
  );

  const createStaff = () => run(
    () => addStaffAccountAction({ fullName: staffForm.name, email: staffForm.email, role: staffForm.role }),
    "Staff account created.",
    (result) => {
      if (result.data?.tempPassword) setTempPassword({ email: staffForm.email, password: result.data.tempPassword });
      setStaffForm({ name: "", email: "", role: "technician" });
    },
  );

  const renderJobSelector = () => (
    <label className="block space-y-2">
      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">Service call</span>
      <select value={selectedJob?.id ?? ""} onChange={(event) => setSelectedJobId(event.target.value)} className="w-full rounded-2xl border border-[#2d7dff]/25 bg-black px-4 py-3 text-white">
        <option value="">Choose active call</option>
        {activeJobs.map((job) => <option key={job.id} value={job.id}>{job.customerName} • {job.assignedTechName ?? "Unassigned"} • {job.scheduledWindow ?? job.status.replace(/_/g, " ")}</option>)}
      </select>
    </label>
  );

  return <div className="space-y-5">
    <section className="rounded-3xl border border-[#2d7dff]/25 bg-black/35 p-4 sm:p-5">
      <div className="mb-4 flex items-center gap-3">
        <div className="rounded-2xl border border-[#2d7dff]/30 bg-[#2d7dff]/10 p-2.5"><BriefcaseBusiness className="h-5 w-5 text-[#8ffafa]" /></div>
        <div><h2 className="text-lg font-semibold text-white">Quick Create</h2><p className="text-sm text-zinc-400">Pick what you want to make. Only that form opens.</p></div>
      </div>
      <div className="space-y-4">{GROUPS.map((group) => <div key={group.label}><p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">{group.label}</p><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{group.items.map((item) => {
        const Icon = ICONS[item.mode];
        const active = mode === item.mode;
        return <button key={item.mode} type="button" onClick={() => { setMode(item.mode); setError(null); setMessage(null); }} className={`flex min-h-20 items-center gap-3 rounded-2xl border p-3 text-left transition ${active ? "border-[#8ffafa]/70 bg-[#2d7dff]/15 shadow-[0_0_18px_rgba(45,125,255,0.18)]" : "border-[#2d7dff]/18 bg-zinc-950/60 hover:bg-[#2d7dff]/8"}`}><span className="rounded-xl border border-[#2d7dff]/20 bg-black/60 p-2"><Icon className="h-4 w-4 text-[#8ffafa]" /></span><span><span className="block font-medium text-white">{item.label}</span><span className="mt-0.5 block text-xs text-zinc-500">{item.helper}</span></span></button>;
      })}</div></div>)}</div>
    </section>

    {error ? <p className="rounded-2xl border border-rose-500/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p> : null}
    {message ? <p className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{message}</p> : null}

    <section className="rounded-3xl border border-[#2d7dff]/25 bg-black/35 p-4 sm:p-5">
      {mode === "customer" ? <div className="space-y-4"><div><h3 className="text-xl font-semibold text-white">Create customer</h3><p className="mt-1 text-sm text-zinc-400">Add the customer once, then use the same record for calls, equipment and billing.</p></div><div className="grid gap-3 sm:grid-cols-2"><input value={customerForm.name} onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })} placeholder="Customer / business name" className="rounded-2xl border border-[#2d7dff]/25 bg-black px-4 py-3 text-white" /><input value={customerForm.phone} onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })} placeholder="Phone" className="rounded-2xl border border-[#2d7dff]/25 bg-black px-4 py-3 text-white" /><input value={customerForm.email} onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })} placeholder="Email" className="rounded-2xl border border-[#2d7dff]/25 bg-black px-4 py-3 text-white" /><input value={customerForm.address} onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })} placeholder="Address" className="rounded-2xl border border-[#2d7dff]/25 bg-black px-4 py-3 text-white" /></div><button type="button" onClick={createCustomer} disabled={pending || !customerForm.name.trim()} className="w-full rounded-2xl border border-[#2d7dff] bg-[#2d7dff]/10 px-4 py-3 font-medium text-[#d9fbff] disabled:opacity-50">{pending ? "Creating..." : "Create customer"}</button>{newCustomerId ? <button type="button" onClick={() => setMode("job")} className="w-full rounded-2xl border border-[#2d7dff]/25 px-4 py-3 text-sm text-white">Create a service call for this customer</button> : null}</div> : null}

      {mode === "job" ? <div className="space-y-4"><div><h3 className="text-xl font-semibold text-white">Create service call</h3><p className="mt-1 text-sm text-zinc-400">Create, schedule and assign the call in one place. Your manager account can be assigned too.</p></div><div className="grid gap-3 sm:grid-cols-2"><select value={jobForm.customerId} onChange={(e) => setJobForm({ ...jobForm, customerId: e.target.value })} className="rounded-2xl border border-[#2d7dff]/25 bg-black px-4 py-3 text-white"><option value="">Choose customer</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select><select value={jobForm.assignedTechId} onChange={(e) => setJobForm({ ...jobForm, assignedTechId: e.target.value })} className="rounded-2xl border border-[#2d7dff]/25 bg-black px-4 py-3 text-white"><option value="">Unassigned</option>{technicians.map((tech) => <option key={tech.id} value={tech.id}>{tech.fullName}{tech.role === "manager" ? " • Owner/Manager" : ""}</option>)}</select><input value={jobForm.location} onChange={(e) => setJobForm({ ...jobForm, location: e.target.value })} placeholder="Job location" className="rounded-2xl border border-[#2d7dff]/25 bg-black px-4 py-3 text-white" /><input value={jobForm.scheduledWindow} onChange={(e) => setJobForm({ ...jobForm, scheduledWindow: e.target.value })} placeholder="Schedule, e.g. Today 2-4 PM" className="rounded-2xl border border-[#2d7dff]/25 bg-black px-4 py-3 text-white" /></div><textarea value={jobForm.scope} onChange={(e) => setJobForm({ ...jobForm, scope: e.target.value })} rows={4} placeholder="Complaint / scope of work" className="w-full rounded-2xl border border-[#2d7dff]/25 bg-black px-4 py-3 text-white" /><button type="button" onClick={createJob} disabled={pending || !jobForm.customerId} className="w-full rounded-2xl border border-[#2d7dff] bg-[#2d7dff]/10 px-4 py-3 font-medium text-[#d9fbff] disabled:opacity-50">{pending ? "Creating..." : "Create service call"}</button></div> : null}

      {mode === "estimate" ? <div className="space-y-4"><div><h3 className="text-xl font-semibold text-white">Create estimate</h3><p className="mt-1 text-sm text-zinc-400">Choose the service call, then build the quote below without leaving Creation Center.</p></div>{renderJobSelector()}{!selectedJob ? <p className="rounded-2xl border border-[#2d7dff]/15 bg-zinc-950/60 p-4 text-sm text-zinc-400">Create a service call first.</p> : selectedBilling ? <div className="space-y-3 rounded-2xl border border-[#2d7dff]/20 bg-zinc-950/70 p-4"><p className="font-medium text-white">Billing document already exists: {selectedBilling.invoiceNumber}</p><p className="text-sm text-zinc-400">Status: {selectedBilling.status.replace(/_/g, " ")}</p><div className="grid gap-2 sm:grid-cols-2"><Link href={`/technician?job=${selectedJob.id}`} className="rounded-xl border border-[#2d7dff]/25 px-4 py-3 text-center text-sm text-[#d9fbff]">Open / revise estimate</Link><Link href={`/portal/${selectedBilling.portalToken}`} target="_blank" className="rounded-xl border border-[#2d7dff]/25 px-4 py-3 text-center text-sm text-white">Customer view</Link></div></div> : <EstimateComposer jobId={selectedJob.id} suggestedItems={[]} />}</div> : null}

      {mode === "invoice" ? <div className="space-y-4"><div><h3 className="text-xl font-semibold text-white">Create / open invoice</h3><p className="mt-1 text-sm text-zinc-400">Chill Bros keeps the signed workflow intact: create the billing document here, then customer approval issues the invoice.</p></div>{renderJobSelector()}{!selectedJob ? <p className="text-sm text-zinc-400">Create a service call first.</p> : selectedBilling?.status === "approved" ? <div className="space-y-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4"><p className="font-medium text-white">Invoice {selectedBilling.invoiceNumber} is issued.</p><p className="text-sm text-zinc-400">Payment: {selectedBilling.paymentStatus.replace(/_/g, " ")}</p><div className="grid gap-2 sm:grid-cols-2"><Link href={`/portal/${selectedBilling.portalToken}`} target="_blank" className="rounded-xl border border-[#2d7dff]/25 px-4 py-3 text-center text-sm text-[#d9fbff]">Open invoice</Link><Link href={`/portal/${selectedBilling.portalToken}/document`} target="_blank" className="rounded-xl border border-[#2d7dff]/25 px-4 py-3 text-center text-sm text-white">Print / PDF document</Link></div></div> : selectedBilling ? <div className="space-y-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4"><p className="font-medium text-white">Estimate {selectedBilling.invoiceNumber} is waiting for approval.</p><p className="text-sm text-zinc-400">Once approved, it becomes the invoice automatically.</p><div className="grid gap-2 sm:grid-cols-2"><Link href={`/technician?job=${selectedJob.id}`} className="rounded-xl border border-[#2d7dff]/25 px-4 py-3 text-center text-sm text-[#d9fbff]">Revise quote</Link><Link href={`/portal/${selectedBilling.portalToken}`} target="_blank" className="rounded-xl border border-[#2d7dff]/25 px-4 py-3 text-center text-sm text-white">Open customer approval</Link></div></div> : <div className="space-y-3"><p className="rounded-2xl border border-[#2d7dff]/15 bg-zinc-950/60 p-4 text-sm text-zinc-400">No billing document exists for this call yet. Build it below. Customer approval will issue the invoice.</p><EstimateComposer jobId={selectedJob.id} suggestedItems={[]} /></div>}</div> : null}

      {mode === "technician" ? <div className="space-y-4"><div><h3 className="text-xl font-semibold text-white">Create technician / staff login</h3><p className="mt-1 text-sm text-zinc-400">Creates a real Supabase login and gives you a temporary password once.</p></div>{tempPassword ? <div className="rounded-2xl border border-[#2d7dff] bg-[#2d7dff]/10 p-4"><p className="text-sm text-zinc-300">Temporary password for {tempPassword.email}</p><p className="mt-2 break-all font-mono text-xl text-[#bafcfc]">{tempPassword.password}</p><p className="mt-2 text-xs text-zinc-500">Copy it now. It is not stored in plaintext.</p></div> : null}<div className="grid gap-3 sm:grid-cols-2"><input value={staffForm.name} onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })} placeholder="Full name" className="rounded-2xl border border-[#2d7dff]/25 bg-black px-4 py-3 text-white" /><input value={staffForm.email} onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })} type="email" placeholder="Email login" className="rounded-2xl border border-[#2d7dff]/25 bg-black px-4 py-3 text-white" /></div><select value={staffForm.role} onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value as StaffRole })} className="w-full rounded-2xl border border-[#2d7dff]/25 bg-black px-4 py-3 text-white"><option value="technician">Technician</option><option value="office">Office / Dispatch</option><option value="manager">Manager</option></select><button type="button" onClick={createStaff} disabled={pending || !staffForm.name.trim() || !staffForm.email.trim()} className="w-full rounded-2xl border border-[#2d7dff] bg-[#2d7dff]/10 px-4 py-3 font-medium text-[#d9fbff] disabled:opacity-50">{pending ? "Creating..." : "Create staff account"}</button></div> : null}

      {mode === "document" ? <div className="space-y-4"><div><h3 className="text-xl font-semibold text-white">Customer documents</h3><p className="mt-1 text-sm text-zinc-400">Choose a call for its estimate/invoice document, or jump directly to the other document families.</p></div>{renderJobSelector()}{selectedBilling ? <div className="grid gap-2 sm:grid-cols-2"><Link href={`/portal/${selectedBilling.portalToken}/document`} target="_blank" className="rounded-2xl border border-[#2d7dff]/25 px-4 py-3 text-center text-sm text-[#d9fbff]">Estimate / Invoice document</Link><Link href={`/portal/${selectedBilling.portalToken}`} target="_blank" className="rounded-2xl border border-[#2d7dff]/25 px-4 py-3 text-center text-sm text-white">Customer approval view</Link></div> : <button type="button" onClick={() => setMode("estimate")} className="w-full rounded-2xl border border-[#2d7dff]/25 px-4 py-3 text-sm text-white">Create billing document first</button>}<div className="grid gap-2 sm:grid-cols-3"><Link href="/agreements" className="rounded-2xl border border-[#2d7dff]/20 bg-zinc-950/60 px-4 py-3 text-center text-sm text-white">Service agreements</Link><Link href="/customers" className="rounded-2xl border border-[#2d7dff]/20 bg-zinc-950/60 px-4 py-3 text-center text-sm text-white">Customer records</Link><Link href="/invoices" className="rounded-2xl border border-[#2d7dff]/20 bg-zinc-950/60 px-4 py-3 text-center text-sm text-white">Invoice Center</Link></div></div> : null}
    </section>
  </div>;
}
