import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import { createServiceRoleClient } from "@/lib/supabase/service-client";
import { cancelRevenueTask, completeRevenueTask, rescheduleRevenueTask } from "../task-actions";

export const dynamic = "force-dynamic";
const input = "min-h-10 w-full rounded-xl border border-cyan-400/30 bg-black/50 px-3 py-2 text-white";
function currentTimeMs() { return Date.now(); }

export default async function RevenueTasksPage() {
  const profile = await getCurrentStaffProfile();
  if (!profile || !["manager", "office"].includes(profile.role)) redirect("/");
  const client = createServiceRoleClient();
  let query = client.from("chillbros_revenue_tasks").select("id,lead_id,task_type,description,due_at,status,assigned_user,created_at").in("status", ["open", "in_progress", "overdue"]).order("due_at", { ascending: true }).limit(100);
  if (profile.role !== "manager") query = query.eq("assigned_user", profile.id);
  const { data: tasks, error } = await query;

  if (error) {
    return <AppShell title="Sales Tasks" description="Revenue Radar follow-ups and appointments."><div className="mx-auto max-w-4xl text-left"><p className="rounded-2xl border border-amber-300/30 bg-amber-400/5 p-4 text-amber-100">Sales task tracking is waiting for the additive Sales Command database migration. Existing Revenue Radar remains unchanged.</p></div></AppShell>;
  }

  const leadIds = [...new Set((tasks ?? []).map((task) => task.lead_id))];
  const { data: leads } = leadIds.length ? await client.from("chillbros_revenue_prospects").select("id,business_name,sales_status,score").in("id", leadIds) : { data: [] };
  const leadMap = new Map((leads ?? []).map((lead) => [lead.id, lead]));
  const now = currentTimeMs();
  const overdue = (tasks ?? []).filter((task) => new Date(task.due_at).getTime() < now);
  const dueToday = (tasks ?? []).filter((task) => {
    const due = new Date(task.due_at);
    const today = new Date();
    return due.getFullYear() === today.getFullYear() && due.getMonth() === today.getMonth() && due.getDate() === today.getDate();
  });

  return <AppShell title="Sales Tasks" description={profile.role === "manager" ? "All active Revenue Radar follow-up work." : "Your assigned Revenue Radar follow-up work."}><div className="mx-auto max-w-4xl space-y-5 text-left">
    <div className="flex flex-wrap items-center justify-between gap-3"><Link href="/revenue-radar" className="text-cyan-200">← Revenue Radar</Link><span className="text-xs text-zinc-500">{tasks?.length ?? 0} active</span></div>
    <section className="grid grid-cols-3 gap-2 text-center">
      <div className="rounded-2xl border border-white/10 bg-black/30 p-3"><strong className="block text-xl text-white">{tasks?.length ?? 0}</strong><span className="text-xs text-zinc-400">Open</span></div>
      <div className="rounded-2xl border border-red-300/20 bg-red-400/5 p-3"><strong className="block text-xl text-red-100">{overdue.length}</strong><span className="text-xs text-zinc-400">Overdue</span></div>
      <div className="rounded-2xl border border-cyan-300/20 bg-cyan-400/5 p-3"><strong className="block text-xl text-cyan-100">{dueToday.length}</strong><span className="text-xs text-zinc-400">Due today</span></div>
    </section>

    <section className="space-y-3">
      {(tasks ?? []).map((task) => {
        const lead = leadMap.get(task.lead_id);
        const isOverdue = new Date(task.due_at).getTime() < now;
        return <article key={task.id} className={`rounded-2xl border bg-black/35 p-4 ${isOverdue ? "border-red-300/30" : "border-white/10"}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><Link href={`/revenue-radar/${task.lead_id}`} className="font-bold text-white hover:text-cyan-200">{lead?.business_name || "Revenue Radar lead"}</Link><p className="mt-1 text-xs text-zinc-400">{task.task_type.replaceAll("_", " ")} · lead {lead?.sales_status?.replaceAll("_", " ") || "status pending"}</p></div>
            <span className={isOverdue ? "text-sm font-semibold text-red-200" : "text-sm text-cyan-200"}>{isOverdue ? "OVERDUE · " : ""}{new Date(task.due_at).toLocaleString()}</span>
          </div>
          <p className="mt-3 text-sm text-zinc-200">{task.description}</p>
          <div className="mt-4 grid gap-2 lg:grid-cols-3">
            <form action={completeRevenueTask} className="flex gap-2"><input type="hidden" name="task_id" value={task.id} /><input className={input} name="completion_notes" required placeholder="Completion notes" /><button className="rounded-xl bg-cyan-300 px-3 font-bold text-black">Complete</button></form>
            <form action={rescheduleRevenueTask} className="flex gap-2"><input type="hidden" name="task_id" value={task.id} /><input className={input} name="due_at" type="datetime-local" required /><button className="rounded-xl border border-cyan-300/40 px-3 text-cyan-100">Reschedule</button></form>
            <form action={cancelRevenueTask} className="flex gap-2"><input type="hidden" name="task_id" value={task.id} /><input className={input} name="cancellation_reason" required placeholder="Cancellation reason" /><button className="rounded-xl border border-red-300/30 px-3 text-red-100">Cancel</button></form>
          </div>
        </article>;
      })}
      {(tasks ?? []).length === 0 ? <p className="rounded-2xl border border-white/10 p-6 text-center text-zinc-500">No active sales tasks. Humanity briefly achieved inbox zero.</p> : null}
    </section>
  </div></AppShell>;
}
