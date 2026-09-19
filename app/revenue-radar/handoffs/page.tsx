import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import { createServiceRoleClient } from "@/lib/supabase/service-client";
import {
  acceptRevenueHandoff,
  assignRevenueHandoff,
  completeRevenueHandoff,
  declineRevenueHandoff,
  scheduleRevenueHandoff,
} from "../handoff-actions";

export const dynamic = "force-dynamic";
const input = "min-h-11 w-full rounded-xl border border-cyan-400/30 bg-black/50 px-3 py-2 text-white";
const area = `${input} resize-y`;

export default async function RevenueHandoffsPage() {
  const profile = await getCurrentStaffProfile();
  if (!profile || !["manager", "technician"].includes(profile.role)) redirect("/");
  const client = createServiceRoleClient();

  let query = client.from("chillbros_revenue_handoffs").select("id,lead_id,status,urgency,customer_contact,equipment_type,customer_reported_problem,business_impact,best_contact,assigned_technician,decline_reason,technical_notes,resolution,scheduled_at,scheduled_location,created_at").order("created_at", { ascending: false }).limit(50);
  if (profile.role === "technician") query = query.eq("assigned_technician", profile.id);
  const { data: handoffs, error } = await query;

  if (error) {
    return <AppShell title="Technician Handoffs" description="Customer-reported technical requests from Revenue Radar."><div className="mx-auto max-w-4xl text-left">
      <p className="rounded-2xl border border-amber-300/30 bg-amber-400/5 p-4 text-amber-100">The Sales Command handoff schema is not deployed to this database yet. Existing field jobs are unchanged.</p>
    </div></AppShell>;
  }

  const leadIds = [...new Set((handoffs ?? []).map((handoff) => handoff.lead_id))];
  const [{ data: leads }, { data: technicians }] = await Promise.all([
    leadIds.length ? client.from("chillbros_revenue_prospects").select("id,business_name,contact_name,contact_phone,contact_email,sales_status").in("id", leadIds) : Promise.resolve({ data: [] }),
    profile.role === "manager" ? client.from("chillbros_profiles").select("id,full_name,status").eq("role", "technician").eq("status", "active").order("full_name") : Promise.resolve({ data: [] }),
  ]);
  const leadMap = new Map((leads ?? []).map((lead) => [lead.id, lead]));
  const techMap = new Map((technicians ?? []).map((tech) => [tech.id, tech.full_name]));
  const active = (handoffs ?? []).filter((handoff) => !["completed", "declined"].includes(handoff.status));
  const closed = (handoffs ?? []).filter((handoff) => ["completed", "declined"].includes(handoff.status));

  const renderHandoff = (handoff: NonNullable<typeof handoffs>[number]) => {
    const lead = leadMap.get(handoff.lead_id);
    const assignedName = handoff.assigned_technician === profile.id ? profile.full_name : techMap.get(handoff.assigned_technician) || (handoff.assigned_technician ? "Assigned technician" : "Unassigned");
    return <article key={handoff.id} className="rounded-2xl border border-white/10 bg-black/35 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Link href={`/revenue-radar/${handoff.lead_id}`} className="text-lg font-bold text-white hover:text-cyan-200">{lead?.business_name || "Revenue Radar lead"}</Link>
          <p className="mt-1 text-xs text-zinc-400">{assignedName} · created {new Date(handoff.created_at).toLocaleString()}</p>
        </div>
        <div className="flex gap-2"><span className="rounded-full border border-amber-300/30 px-2 py-1 text-xs text-amber-200">{handoff.urgency}</span><span className="rounded-full border border-cyan-300/30 px-2 py-1 text-xs text-cyan-200">{handoff.status}</span></div>
      </div>
      <div className="mt-3 rounded-xl border border-amber-300/20 bg-amber-400/5 p-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-200">Customer-reported · not technically diagnosed</p>
        <p className="mt-1 text-sm text-zinc-100">{handoff.customer_reported_problem}</p>
      </div>
      <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        <p><span className="text-zinc-500">Equipment:</span> {handoff.equipment_type || "Unknown"}</p>
        <p><span className="text-zinc-500">Business impact:</span> {handoff.business_impact || "Not recorded"}</p>
        <p><span className="text-zinc-500">Best contact:</span> {handoff.best_contact || lead?.contact_phone || lead?.contact_email || "Not recorded"}</p>
        <p><span className="text-zinc-500">Customer contact:</span> {handoff.customer_contact || lead?.contact_name || "Not recorded"}</p>
      </div>

      {profile.role === "manager" && !["completed", "declined"].includes(handoff.status) ? <form action={assignRevenueHandoff} className="mt-4 flex flex-col gap-2 rounded-xl border border-white/10 p-3 sm:flex-row">
        <input type="hidden" name="handoff_id" value={handoff.id} />
        <select className={input} name="assigned_technician" defaultValue={handoff.assigned_technician ?? ""} required><option value="" disabled>Assign technician</option>{(technicians ?? []).map((tech) => <option key={tech.id} value={tech.id}>{tech.full_name}</option>)}</select>
        <button className="min-h-11 shrink-0 rounded-xl border border-cyan-300/40 px-4 font-semibold text-cyan-100">Assign</button>
      </form> : null}

      {handoff.status === "received" && handoff.assigned_technician ? <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <form action={acceptRevenueHandoff}><input type="hidden" name="handoff_id" value={handoff.id} /><button className="min-h-11 w-full rounded-xl bg-cyan-300 px-4 font-bold text-black">Accept Technical Request</button></form>
        <form action={declineRevenueHandoff} className="flex gap-2"><input type="hidden" name="handoff_id" value={handoff.id} /><input className={input} name="decline_reason" required placeholder="Reason to decline" /><button className="min-h-11 rounded-xl border border-red-300/40 px-3 font-semibold text-red-100">Decline</button></form>
      </div> : null}

      {["accepted", "scheduled"].includes(handoff.status) ? <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <form action={scheduleRevenueHandoff} className="grid gap-2 rounded-xl border border-cyan-300/20 p-3">
          <input type="hidden" name="handoff_id" value={handoff.id} />
          <strong className="text-sm text-cyan-100">{handoff.status === "scheduled" ? "Reschedule technical follow-up" : "Schedule technical follow-up"}</strong>
          <input className={input} name="scheduled_at" type="datetime-local" required defaultValue={handoff.scheduled_at ? new Date(handoff.scheduled_at).toISOString().slice(0,16) : ""} />
          <input className={input} name="scheduled_location" required defaultValue={handoff.scheduled_location ?? ""} placeholder="Site address or remote method" />
          <button className="min-h-11 rounded-xl border border-cyan-300/40 px-4 font-semibold text-cyan-100">Save Schedule</button>
        </form>
        <form action={completeRevenueHandoff} className="grid gap-2 rounded-xl border border-emerald-300/20 p-3">
          <input type="hidden" name="handoff_id" value={handoff.id} />
          <strong className="text-sm text-emerald-100">Complete technical handoff</strong>
          <textarea className={area} name="technical_notes" required rows={2} placeholder="Technical findings after evaluation" />
          <textarea className={area} name="resolution" required rows={2} placeholder="Resolution or unresolved condition" />
          <button className="min-h-11 rounded-xl border border-emerald-300/40 px-4 font-semibold text-emerald-100">Complete Handoff</button>
        </form>
      </div> : null}

      {handoff.status === "scheduled" ? <p className="mt-3 text-sm text-cyan-200">Scheduled {new Date(handoff.scheduled_at).toLocaleString()} · {handoff.scheduled_location}</p> : null}
      {handoff.status === "declined" ? <p className="mt-3 text-sm text-red-200">Declined: {handoff.decline_reason}</p> : null}
      {handoff.status === "completed" ? <div className="mt-3 rounded-xl border border-emerald-300/20 p-3 text-sm"><p><strong>Technical notes:</strong> {handoff.technical_notes}</p><p className="mt-1"><strong>Resolution:</strong> {handoff.resolution}</p></div> : null}
    </article>;
  };

  return <AppShell title="Technician Handoffs" description="Customer-reported technical requests with controlled technician ownership."><div className="mx-auto max-w-4xl space-y-5 text-left">
    <div className="flex flex-wrap items-center justify-between gap-3"><Link href={profile.role === "manager" ? "/revenue-radar" : "/technician"} className="text-cyan-200">← Back</Link><span className="text-xs text-zinc-500">{active.length} active · {closed.length} closed shown</span></div>
    <section><h2 className="mb-3 text-lg font-semibold text-white">Active requests</h2><div className="space-y-3">{active.map(renderHandoff)}{active.length === 0 ? <p className="rounded-2xl border border-white/10 p-5 text-center text-zinc-500">No active technician handoffs.</p> : null}</div></section>
    {closed.length ? <details className="rounded-2xl border border-white/10 bg-black/25 p-4"><summary className="cursor-pointer font-semibold text-zinc-300">Recent closed handoffs ({closed.length})</summary><div className="mt-3 space-y-3">{closed.slice(0, 10).map(renderHandoff)}</div></details> : null}
  </div></AppShell>;
}
