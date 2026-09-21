import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { RevenueRadarList } from "@/components/revenue-radar-list";
import { ScanForLeadsButton } from "@/components/scan-for-leads-button";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import { createServiceRoleClient } from "@/lib/supabase/service-client";
import { addProspect, scanForLeads } from "./actions";

export const dynamic = "force-dynamic";
const input = "min-h-11 w-full rounded-xl border border-cyan-400/30 bg-black/50 px-3 py-2 text-white";
function currentTimeMs() { return Date.now(); }

export default async function RevenueRadarPage() {
  const profile = await getCurrentStaffProfile();
  if (!profile || !["manager", "office"].includes(profile.role)) redirect("/");

  const client = createServiceRoleClient();
  let prospectsQuery = client
    .from("chillbros_revenue_prospects")
    .select("id,business_name,city,category,service_line,signal_summary,signal_verified,signal_observed_at,score,status,follow_up_at,actual_revenue,direct_cost,business_address,contact_phone,contact_email,contact_name,contact_role,verification_status,source_url,assigned_salesperson,sales_status")
    .order("score", { ascending: false });
  if (profile.role === "office") prospectsQuery = prospectsQuery.eq("assigned_salesperson", profile.id);
  const { data, error } = await prospectsQuery.limit(100);

  const prospects = data ?? [];
  const newCount = prospects.filter((p) => p.status === "new").length;
  const highPriority = prospects.filter((p) => Number(p.score) >= 65).length;

  let salesCommandReady = false;
  let salesPipeline: Array<{ id: string; business_name: string; sales_status: string; assigned_salesperson: string | null; priority: string; follow_up_at: string | null; last_activity_at: string | null }> = [];
  let openTasks: Array<{ id: string; lead_id: string; task_type: string; description: string; due_at: string; status: string; assigned_user: string | null }> = [];
  let openHandoffs: Array<{ id: string; lead_id: string; status: string; urgency: string; customer_reported_problem: string; created_at: string }> = [];
  let currentCardLeadIds = new Set<string>();

  if (profile.role === "manager") {
    const [pipelineResult, tasksResult, handoffsResult, cardsResult] = await Promise.all([
      client.from("chillbros_revenue_prospects").select("id,business_name,sales_status,assigned_salesperson,priority,follow_up_at,last_activity_at").order("score", { ascending: false }).limit(100),
      client.from("chillbros_revenue_tasks").select("id,lead_id,task_type,description,due_at,status,assigned_user").in("status", ["open", "in_progress", "overdue"]).order("due_at", { ascending: true }).limit(50),
      client.from("chillbros_revenue_handoffs").select("id,lead_id,status,urgency,customer_reported_problem,created_at").in("status", ["received", "accepted", "scheduled"]).order("created_at", { ascending: true }).limit(50),
      client.from("chillbros_revenue_battle_cards").select("lead_id").eq("is_current", true).limit(200),
    ]);
    salesCommandReady = !pipelineResult.error && !tasksResult.error && !handoffsResult.error && !cardsResult.error;
    if (salesCommandReady) {
      salesPipeline = pipelineResult.data ?? [];
      openTasks = tasksResult.data ?? [];
      openHandoffs = handoffsResult.data ?? [];
      currentCardLeadIds = new Set((cardsResult.data ?? []).map((card) => card.lead_id));
    }
  }

  const now = currentTimeMs();
  const readyToCall = salesPipeline.filter((lead) => lead.sales_status === "ready_to_call").length;
  const unassigned = salesPipeline.filter((lead) => !lead.assigned_salesperson).length;
  const missingCards = salesPipeline.filter((lead) => !currentCardLeadIds.has(lead.id)).length;
  const overdueTasks = openTasks.filter((task) => new Date(task.due_at).getTime() < now).length;
  const proposalCount = salesPipeline.filter((lead) => lead.sales_status === "proposal_requested").length;
  const wonCount = salesPipeline.filter((lead) => lead.sales_status === "won").length;
  const leadNames = new Map(salesPipeline.map((lead) => [lead.id, lead.business_name]));

  return <AppShell title="Revenue Radar" description={profile.role === "office" ? "Your assigned Revenue Radar leads, sales follow-up, and next actions." : "Automatically discover commercial prospects, rank them, then execute the sales follow-up that turns them into Chill Pros work."}>
    <div className="mx-auto max-w-5xl space-y-5 text-left">
      {error ? <p className="rounded-xl border border-amber-400 p-3 text-amber-200">Revenue Radar storage is not ready. {error.message}</p> : null}

      <section className="rounded-3xl border border-cyan-300/30 bg-cyan-400/5 p-5 shadow-[0_0_30px_rgba(34,211,238,0.08)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">{profile.role === "office" ? "My assigned sales queue" : "Automatic lead generation"}</p>
            <h2 className="mt-1 text-2xl font-semibold text-white">{profile.role === "office" ? "Work the leads assigned to you." : "Let Revenue Radar hunt for you."}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-300">
              {profile.role === "office" ? "This view is limited to your assigned Revenue Radar leads. Open a lead for its Battle Card, call logging, follow-up tasks, contacts, and technician handoff." : "Scan public commercial business data around San Antonio, identify businesses with strong HVAC/R, refrigeration, ice, and kitchen-equipment demand, remove duplicates, and rank the best prospects automatically."}
            </p>
          </div>
          {profile.role === "manager" ? <ScanForLeadsButton action={scanForLeads} /> : null}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl border border-white/10 bg-black/30 p-3"><strong className="block text-xl text-white">{prospects.length}</strong><span className="text-xs text-zinc-400">{profile.role === "office" ? "Assigned" : "On radar"}</span></div>
          <div className="rounded-2xl border border-white/10 bg-black/30 p-3"><strong className="block text-xl text-white">{newCount}</strong><span className="text-xs text-zinc-400">New</span></div>
          <div className="rounded-2xl border border-white/10 bg-black/30 p-3"><strong className="block text-xl text-cyan-200">{highPriority}</strong><span className="text-xs text-zinc-400">65+ score</span></div>
        </div>
      </section>

      {profile.role === "manager" ? <section className="rounded-3xl border border-white/10 bg-black/35 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">Sales Command Center</p>
            <h2 className="mt-1 text-xl font-semibold text-white">Manager visibility</h2>
          </div>
          <span className={`rounded-full border px-3 py-1 text-xs ${salesCommandReady ? "border-emerald-300/30 text-emerald-200" : "border-amber-300/30 text-amber-200"}`}>{salesCommandReady ? "Sales schema ready" : "Sales schema pending deployment"}</span>
        </div>
        {salesCommandReady ? <>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {[
              ["Ready to Call", readyToCall],
              ["Unassigned", unassigned],
              ["Missing Card", missingCards],
              ["Overdue Tasks", overdueTasks],
              ["Open Handoffs", openHandoffs.length],
              ["Proposals / Won", `${proposalCount} / ${wonCount}`],
            ].map(([label, metric]) => <div key={String(label)} className="rounded-2xl border border-white/10 bg-black/30 p-3 text-center"><strong className="block text-xl text-white">{metric}</strong><span className="text-[11px] text-zinc-400">{label}</span></div>)}
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
              <div className="flex items-center justify-between"><h3 className="font-semibold text-white">Due / overdue work</h3><span className="text-xs text-zinc-500">{openTasks.length} open</span></div>
              <div className="mt-2 space-y-2">
                {openTasks.slice(0, 5).map((task) => <Link key={task.id} href={`/revenue-radar/${task.lead_id}`} className="block rounded-xl border border-white/10 p-3 hover:border-cyan-300/40">
                  <div className="flex justify-between gap-2 text-sm"><strong>{leadNames.get(task.lead_id) || "Lead"}</strong><span className={new Date(task.due_at).getTime() < now ? "text-red-200" : "text-cyan-200"}>{new Date(task.due_at).toLocaleString()}</span></div>
                  <p className="mt-1 text-xs text-zinc-400">{task.task_type.replaceAll("_", " ")} · {task.description}</p>
                </Link>)}
                {openTasks.length === 0 ? <p className="py-3 text-sm text-zinc-500">No open sales tasks.</p> : null}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
              <div className="flex items-center justify-between"><h3 className="font-semibold text-white">Technical handoffs</h3><span className="text-xs text-zinc-500">{openHandoffs.length} active</span></div>
              <div className="mt-2 space-y-2">
                {openHandoffs.slice(0, 5).map((handoff) => <Link key={handoff.id} href={`/revenue-radar/${handoff.lead_id}`} className="block rounded-xl border border-amber-300/15 p-3 hover:border-amber-300/40">
                  <div className="flex justify-between gap-2 text-sm"><strong>{leadNames.get(handoff.lead_id) || "Lead"}</strong><span className="text-amber-200">{handoff.urgency}</span></div>
                  <p className="mt-1 line-clamp-2 text-xs text-zinc-400">Customer reported: {handoff.customer_reported_problem}</p>
                </Link>)}
                {openHandoffs.length === 0 ? <p className="py-3 text-sm text-zinc-500">No active technician handoffs.</p> : null}
              </div>
            </div>
          </div>
        </> : <p className="mt-3 rounded-xl border border-amber-300/20 bg-amber-400/5 p-3 text-sm text-amber-100">The Sales Command code is ready, but these manager metrics stay dormant until the additive Sales Command migration is approved for production. Existing Revenue Radar remains available below.</p>}
      </section> : null}

      <RevenueRadarList prospects={prospects} />

      {profile.role === "manager" ? <details className="rounded-2xl border border-white/10 bg-black/30 p-4">
        <summary className="cursor-pointer text-sm font-medium text-zinc-300">Add a lead manually (backup only)</summary>
        <form action={addProspect} className="mt-4 grid gap-3 sm:grid-cols-2">
          <label>Business name<input className={input} name="business_name" required maxLength={200} /></label>
          <label>City<input className={input} name="city" defaultValue="San Antonio" required /></label>
          <label>Signal type<select className={input} name="category"><option value="equipment_failure">Equipment failure</option><option value="property_manager">Property or facilities manager</option><option value="opening_remodel">Opening or remodel</option><option value="supplier_referral">Supplier or referral partner</option><option value="other">Other</option></select></label>
          <label>Service<select className={input} name="service_line"><option value="hvac_r">Commercial HVAC/R</option><option value="refrigeration">Refrigeration</option><option value="ice_machine">Ice machine</option><option value="kitchen_equipment">Kitchen equipment</option><option value="exhaust_hood">Exhaust or hood</option><option value="multiple">Multiple</option></select></label>
          <label className="sm:col-span-2">What happened?<textarea className={input} name="signal_summary" required rows={3} /></label>
          <label>Source URL<input className={input} name="source_url" type="url" required /></label>
          <label>Observed at<input className={input} name="signal_observed_at" type="datetime-local" required /></label>
          <label className="sm:col-span-2 flex items-center gap-2"><input type="checkbox" name="signal_verified" />Verified directly with the business</label>
          <button className="min-h-11 rounded-xl border border-cyan-300/50 px-4 font-semibold text-cyan-100 sm:col-span-2">Add manual lead</button>
        </form>
      </details> : null}
    </div>
  </AppShell>;
}
