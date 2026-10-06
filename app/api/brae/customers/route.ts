import { rejectUnlessBrae, noStore } from "@/lib/brae/auth";
import { createServiceRoleClient } from "@/lib/supabase/service-client";
import { JOB_STATUS_LABELS, type JobStatus } from "@/lib/chillbros/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/brae/customers?q=sammy
 * Find customers by name (or phone/email) and show their recent jobs. Read-only.
 */
export async function GET(request: Request) {
  const denied = rejectUnlessBrae(request);
  if (denied) return denied;

  const raw = new URL(request.url).searchParams.get("q") || "";
  // Strip characters that have meaning in PostgREST filter syntax.
  const q = raw.replace(/[%,()*\\]/g, " ").trim().slice(0, 80);
  if (q.length < 2) return Response.json({ ok: false, error: "Give at least 2 characters to search." }, { status: 400 });

  const supabase = createServiceRoleClient();
  const like = `%${q}%`;
  const { data: customers, error } = await supabase
    .from("chillbros_customers")
    .select("id,name,phone,email,address")
    .or(`name.ilike.${like},phone.ilike.${like},email.ilike.${like}`)
    .order("name", { ascending: true })
    .limit(10);
  if (error) return Response.json({ ok: false, error: "Could not search customers." }, { status: 500 });

  const ids = (customers ?? []).map((row) => row.id);
  const recent = new Map<string, Array<{ jobId: string; status: string; scope: string | null; scheduledWindow: string | null; createdAt: string }>>();
  if (ids.length) {
    const { data: jobs } = await supabase
      .from("chillbros_jobs")
      .select("id,customer_id,status,scope,scheduled_window,created_at")
      .in("customer_id", ids)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(50);
    for (const job of jobs ?? []) {
      const list = recent.get(job.customer_id) ?? [];
      if (list.length < 5) {
        list.push({ jobId: job.id, status: JOB_STATUS_LABELS[job.status as JobStatus] ?? job.status, scope: job.scope, scheduledWindow: job.scheduled_window, createdAt: job.created_at });
      }
      recent.set(job.customer_id, list);
    }
  }

  const rows = (customers ?? []).map((row) => ({
    customerId: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    address: row.address,
    recentJobs: recent.get(row.id) ?? [],
  }));

  return Response.json({ ok: true, query: q, count: rows.length, customers: rows }, noStore);
}
