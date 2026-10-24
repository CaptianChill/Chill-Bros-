import { timingSafeEqual } from "node:crypto";

import { textOfficeStaff } from "@/lib/chillbros/staff-sms";
import { createServiceRoleClient } from "@/lib/supabase/service-client";

export const dynamic = "force-dynamic";

// Called by the database (pg_net) when a new service call is created from any screen,
// so office/dispatch staff get a text. Guarded by NOTIFY_WEBHOOK_SECRET.
function authorized(request: Request) {
  const secret = String(process.env.NOTIFY_WEBHOOK_SECRET || "").trim();
  if (!secret) return false;
  const given = Buffer.from(String(request.headers.get("authorization") || ""));
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function POST(request: Request) {
  if (!authorized(request)) return Response.json({ ok: false }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const jobId = String((body as { jobId?: string }).jobId ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(jobId)) return Response.json({ ok: false, error: "jobId required" }, { status: 400 });
  const { data: job } = await createServiceRoleClient().from("chillbros_jobs").select("id,job_number,scope,scheduled_window,location,customer:chillbros_customers(name)").eq("id", jobId).maybeSingle();
  if (!job) return Response.json({ ok: false, error: "not found" }, { status: 404 });
  const c = Array.isArray(job.customer) ? job.customer[0] : job.customer;
  const scope = String(job.scope ?? "");
  const kind = scope.startsWith("Online booking") ? "Booked online" : scope.startsWith("Customer request") ? "Customer request" : "New call";
  const urgent = /EMERGENCY|URGENT/i.test(scope) ? "URGENT " : "";
  const base = String(process.env.NEXT_PUBLIC_APP_URL || "https://chill-bros.vercel.app").replace(/\/$/, "");
  await textOfficeStaff(`Chill Pros: ${urgent}${kind} - ${c?.name ?? "Customer"}. ${job.scheduled_window || "Needs scheduling"}. ${job.location ?? ""} ${base}/jobs/${job.id}`.replace(/\s+/g, " "));
  return Response.json({ ok: true });
}
