import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import { createServiceRoleClient } from "@/lib/supabase/service-client";
import { explainLeadRanking } from "@/lib/chillbros/revenue-sales";
import { updateProspect } from "../actions";
import {
  assignRevenueSalesperson,
  createRevenueTechnicianHandoff,
  logRevenueActivity,
  markRevenueDoNotContact,
} from "../sales-actions";

export const dynamic = "force-dynamic";
const input = "min-h-11 w-full rounded-xl border border-cyan-400/30 bg-black/50 px-3 py-2 text-white";
const area = `${input} resize-y`;

export default async function ProspectPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await getCurrentStaffProfile();
  if (!profile || !["manager", "office"].includes(profile.role)) redirect("/");
  const { id } = await params;
  const client = createServiceRoleClient();
  const [{ data: p }, { data: salesStaff }, { data: leadContacts }] = await Promise.all([
    client.from("chillbros_revenue_prospects").select("*").eq("id", id).maybeSingle(),
    client.from("chillbros_profiles").select("id,full_name,role,status").eq("status", "active").in("role", ["manager", "office"]).order("full_name"),
    client.from("chillbros_revenue_contacts").select("id,name,role,phone,email,verification_status,source,is_primary,notes").eq("lead_id", id).order("is_primary", { ascending: false }).order("created_at", { ascending: true }),
  ]);
  if (!p) notFound();

  const rankingReasons = explainLeadRanking({
    score: Number(p.score),
    category: p.category,
    serviceLine: p.service_line,
    signalSummary: p.signal_summary,
    signalVerified: Boolean(p.signal_verified),
    verificationStatus: p.verification_status,
    observedAt: p.signal_observed_at,
    businessAddress: p.business_address,
    contactName: p.contact_name,
    contactPhone: p.contact_phone,
    contactEmail: p.contact_email,
  });
  const salesStatus = p.sales_status || p.status;
  const field = (label: string, name: string, type = "text") => <label key={name}>{label}<input className={input} name={name} type={type} defaultValue={p[name] ?? ""} /></label>;

  return <AppShell title={p.business_name} description="Revenue Radar sales execution, follow-up, and technical handoff."><div className="mx-auto max-w-3xl space-y-4 text-left">
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm"><Link href="/revenue-radar" className="text-cyan-200">← Revenue Radar</Link><span className="rounded-full border border-cyan-300/30 bg-cyan-400/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-100">Radar 2.1 · Sales View</span></div>

    <section className="rounded-2xl border border-cyan-400/25 bg-black/40 p-4">
      <div className="flex flex-wrap justify-between gap-3">
        <h2 className="text-xl font-bold">{p.score}/100 · {p.service_line.replaceAll("_", " ")}</h2>
        <span className="rounded-full border border-cyan-300/30 px-3 py-1 text-sm text-cyan-200">{String(salesStatus).replaceAll("_", " ")}</span>
      </div>
      <p className="mt-2">{p.signal_summary}</p>
      <p className="mt-2 text-sm text-amber-200">{p.signal_verified ? "Verified directly" : "Unverified public signal; research before outreach"}</p>
      <p className="mt-2 text-sm text-zinc-400">Observed {new Date(p.signal_observed_at).toLocaleString()} · Added {new Date(p.created_at).toLocaleString()}</p>
      <a className="mt-2 block break-all text-cyan-200 underline" href={p.source_url} target="_blank" rel="noreferrer">Open source ↗</a>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-black/30 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Business address</p>
          <p className="mt-1 text-sm text-white">{p.business_address || "Address research pending"}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/30 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Primary contact</p>
          <p className="mt-1 text-sm text-white">{p.contact_name || "Decision-maker research pending"}</p>
          {p.contact_role ? <p className="text-xs text-zinc-400">{p.contact_role}</p> : null}
          <p className="mt-1 text-xs text-cyan-200">{[p.contact_phone, p.contact_email].filter(Boolean).join(" · ") || "Direct contact details pending"}</p>
        </div>
      </div>
      <div className="mt-3 rounded-xl border border-cyan-300/20 bg-cyan-400/5 p-3">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">Why {p.score}/100</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-200">
          {rankingReasons.map((reason) => <li key={reason}>{reason}</li>)}
        </ul>
        <p className="mt-2 text-[11px] text-zinc-500">These are the current ranking drivers available from the lead record. Revenue Radar preserves the stored score and explains the evidence behind its priority.</p>
      </div>
      {(leadContacts ?? []).length > 0 ? <div className="mt-3 rounded-xl border border-white/10 bg-black/30 p-3">
        <div className="flex items-center justify-between gap-2"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">Known contacts</p><Link href={`/revenue-radar/${id}/contacts`} className="text-xs text-cyan-200 underline">Manage contacts</Link></div>
        <div className="mt-2 space-y-2">
          {(leadContacts ?? []).map((contact) => <div key={contact.id} className="rounded-lg border border-white/10 p-2">
            <div className="flex flex-wrap items-start justify-between gap-2"><div><strong className="text-sm text-white">{contact.name || "Unnamed contact"}</strong>{contact.role ? <p className="text-xs text-zinc-400">{contact.role}</p> : null}</div><span className="text-[10px] uppercase text-cyan-200">{contact.is_primary ? "Primary" : contact.verification_status?.replaceAll("_", " ")}</span></div>
            {(contact.phone || contact.email) ? <p className="mt-1 text-xs text-cyan-200">{[contact.phone, contact.email].filter(Boolean).join(" · ")}</p> : <p className="mt-1 text-xs text-zinc-500">No direct phone/email verified.</p>}
            {contact.notes ? <p className="mt-1 text-[11px] text-zinc-500">{contact.notes}</p> : null}
          </div>)}
        </div>
      </div> : null}
      {p.do_not_contact ? <p className="mt-3 rounded-xl border border-red-400/40 bg-red-400/10 p-3 text-sm font-semibold text-red-100">DO NOT CONTACT · {p.do_not_contact_reason || "restriction active"}</p> : null}
    </section>

    {profile.role === "manager" ? <details className="rounded-2xl border border-white/10 bg-black/30 p-4">
      <summary className="cursor-pointer font-semibold">Sales assignment</summary>
      <h2 className="font-semibold">Sales assignment</h2>
      <form action={assignRevenueSalesperson} className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input type="hidden" name="lead_id" value={id} />
        <select className={input} name="assigned_salesperson" defaultValue={p.assigned_salesperson ?? ""} required>
          <option value="" disabled>Select salesperson</option>
          {(salesStaff ?? []).map((staff) => <option key={staff.id} value={staff.id}>{staff.full_name} · {staff.role}</option>)}
        </select>
        <button className="min-h-11 shrink-0 rounded-xl border border-cyan-300/50 px-4 font-semibold text-cyan-100">Assign</button>
      </form>
    </details> : null}

    <details className="rounded-2xl border border-cyan-300/25 bg-black/40 p-4">
      <summary className="cursor-pointer text-lg font-semibold text-white">Log call / activity</summary>
      <form action={logRevenueActivity} className="mt-4 grid gap-3 sm:grid-cols-2">
        <input type="hidden" name="lead_id" value={id} />
        <label>Activity type<select className={input} name="activity_type" defaultValue="call_attempt"><option value="call_attempt">Call attempt</option><option value="connected_call">Connected call</option><option value="voicemail">Voicemail</option><option value="email_message">Email / message</option><option value="inbound_inquiry">Inbound inquiry</option><option value="meeting">Meeting</option><option value="other">Other</option></select></label>
        <label>Outcome<select className={input} name="call_outcome" defaultValue="no_answer"><option value="no_answer">No answer</option><option value="voicemail">Voicemail</option><option value="gatekeeper">Gatekeeper</option><option value="connected">Connected</option><option value="need_identified">Need identified</option><option value="technical_issue">Technical issue reported</option><option value="appointment_scheduled">Appointment scheduled</option><option value="proposal_requested">Proposal requested</option><option value="not_interested">Not interested / no current need</option></select></label>
        <label>Person contacted<input className={input} name="contacted_person" /></label>
        <label>Role<input className={input} name="contacted_role" /></label>
        <label className="sm:col-span-2">Customer statement<textarea className={area} name="customer_statement" rows={3} placeholder="Record the customer's words. Do not diagnose." /></label>
        <label>Need identified<input className={input} name="need_identified" placeholder="Customer-confirmed need only" /></label>
        <label>Equipment mentioned<input className={input} name="equipment_mentioned" placeholder="If discussed" /></label>
        <label>Current vendor<input className={input} name="current_vendor" /></label>
        <label>Urgency<select className={input} name="urgency" defaultValue=""><option value="">Not discussed</option><option value="routine">Routine</option><option value="urgent">Urgent</option><option value="emergency">Emergency</option></select></label>
        <label className="sm:col-span-2">Next step<input className={input} name="next_step" placeholder="One concrete next action" /></label>
        <div className="sm:col-span-2 rounded-xl border border-white/10 bg-black/25 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">Appointment evidence</p>
          <p className="mt-1 text-xs text-zinc-500">Required only when the outcome is Appointment scheduled.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label>Date / time<input className={input} name="appointment_at" type="datetime-local" /></label>
            <label>Appointment type<input className={input} name="appointment_type" placeholder="Service visit / walkthrough / meeting" /></label>
            <label className="sm:col-span-2">Location or remote method<input className={input} name="appointment_location" placeholder="Site address, phone, or video meeting" /></label>
          </div>
        </div>
        <label>Follow up<input className={input} name="follow_up_at" type="datetime-local" /></label>
        <label>Internal notes<input className={input} name="notes" placeholder="Required as loss reason if no future follow-up" /></label>
        <button className="min-h-12 rounded-xl bg-cyan-300 px-4 font-bold text-black sm:col-span-2">Save Activity</button>
      </form>
    </details>

    <details className="rounded-2xl border border-amber-300/25 bg-amber-400/5 p-4">
      <summary className="cursor-pointer text-lg font-semibold text-amber-100">Request technician review</summary>
      <p className="mt-2 rounded-xl border border-amber-300/20 bg-black/30 p-3 text-sm text-amber-50">This information is customer-reported and has not been technically diagnosed.</p>
      <form action={createRevenueTechnicianHandoff} className="mt-4 grid gap-3 sm:grid-cols-2">
        <input type="hidden" name="lead_id" value={id} />
        <label>Customer contact<input className={input} name="customer_contact" defaultValue={p.contact_name ?? ""} /></label>
        <label>Equipment type<input className={input} name="equipment_type" /></label>
        <label className="sm:col-span-2">Customer-reported problem<textarea className={area} name="customer_reported_problem" required rows={3} /></label>
        <label>When did it start?<input className={input} name="problem_started_at" placeholder="Unknown is okay" /></label>
        <label>Equipment status<input className={input} name="equipment_status" placeholder="Running / down / intermittent / unknown" /></label>
        <label>Business impact<input className={input} name="business_impact" /></label>
        <label>Urgency<select className={input} name="urgency" required defaultValue="routine"><option value="routine">Routine</option><option value="urgent">Urgent</option><option value="emergency">Emergency</option></select></label>
        <label>Site access<input className={input} name="site_access" /></label>
        <label>Best contact<input className={input} name="best_contact" defaultValue={p.contact_phone || p.contact_email || ""} /></label>
        <label className="flex items-center gap-2 sm:col-span-2"><input type="checkbox" name="permission_to_follow_up" />Customer permits technical follow-up</label>
        <button className="min-h-12 rounded-xl border border-amber-300/50 px-4 font-bold text-amber-50 sm:col-span-2">Create Technician Handoff</button>
      </form>
    </details>

    {!p.do_not_contact ? <details className="rounded-2xl border border-red-400/20 bg-red-400/5 p-4">
      <summary className="cursor-pointer font-semibold text-red-100">Do Not Contact</summary>
      <form action={markRevenueDoNotContact} className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
        <input type="hidden" name="lead_id" value={id} />
        <input className={input} name="reason" required placeholder="Who requested it and why" />
        <button className="min-h-11 rounded-xl border border-red-400/40 px-4 font-semibold text-red-100">Mark DNC</button>
      </form>
    </details> : null}

    <form action={updateProspect} className="space-y-4"><input type="hidden" name="id" value={id} />
      <section className="grid gap-3 rounded-2xl border border-white/10 bg-black/30 p-4 sm:grid-cols-2"><h2 className="font-semibold sm:col-span-2">Legacy prospect details</h2>
        {field("Name", "contact_name")}{field("Role", "contact_role")}{field("Email", "contact_email", "email")}{field("Phone", "contact_phone", "tel")}
        <label>Legacy status<select className={input} name="status" defaultValue={p.status}>{["new","research","approved","skipped","contacted","quoted","won","lost"].map(s => <option key={s} value={s}>{s.replaceAll("_", " ")}</option>)}</select></label>
        <label>Follow up at<input className={input} type="datetime-local" name="follow_up_at" defaultValue={p.follow_up_at ? new Date(p.follow_up_at).toISOString().slice(0,16) : ""} /></label>
        <label className="sm:col-span-2">Follow-up note<textarea className={area} name="follow_up_note" defaultValue={p.follow_up_note ?? ""} rows={2} /></label>
      </section>
      <section className="grid gap-3 rounded-2xl border border-white/10 bg-black/30 p-4 sm:grid-cols-2"><h2 className="font-semibold sm:col-span-2">Revenue attribution</h2>
        {field("Job ID", "job_id")}{field("Quote or invoice ID", "invoice_id")}{field("Estimated revenue", "estimated_revenue", "number")}{field("Actual revenue", "actual_revenue", "number")}{field("Direct cost", "direct_cost", "number")}
        <p className="self-end text-cyan-200">Gross profit: ${((Number(p.actual_revenue) || 0) - (Number(p.direct_cost) || 0)).toFixed(2)}</p>
        {p.job_id ? <Link className="text-cyan-200 underline" href={`/jobs/${p.job_id}`}>Open linked job</Link> : null}
        {p.invoice_id ? <Link className="text-cyan-200 underline" href="/invoices">Open billing center</Link> : null}
      </section>
      <button className="min-h-11 w-full rounded-xl border border-white/20 px-4 font-semibold text-zinc-100">Save Legacy Prospect Fields</button>
    </form>
  </div></AppShell>;
}
