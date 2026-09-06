import { sendBillingDelivery } from "@/lib/chillbros/billing-delivery";
import { createServiceRoleClient } from "@/lib/supabase/service-client";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = String(process.env.CRON_SECRET || "");
  const auth = request.headers.get("authorization") || "";
  if (!secret || auth !== `Bearer ${secret}`) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const lookAhead = new Date(now.getTime() + 2 * 86400000).toISOString();
  const intervalHours = Math.max(24, Math.min(720, Number(process.env.BILLING_REMINDER_INTERVAL_HOURS || 72)));
  const cutoff = new Date(now.getTime() - intervalHours * 3600000).toISOString();
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.from("chillbros_invoices")
    .select("id,job_id,reminder_count,last_reminder_at,due_at")
    .eq("status", "approved")
    .neq("payment_status", "paid")
    .is("revoked_at", null)
    .not("due_at", "is", null)
    .lte("due_at", lookAhead)
    .or(`last_reminder_at.is.null,last_reminder_at.lt.${cutoff}`)
    .order("due_at", { ascending: true })
    .limit(100);
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

  let sent = 0;
  let failed = 0;
  const details: Array<{ id: string; email: string; sms?: string }> = [];
  for (const invoice of data ?? []) {
    const email = await sendBillingDelivery(invoice.id, "reminder", "email");
    let smsStatus: string | undefined;
    if (String(process.env.BILLING_SMS_REMINDERS || "").toLowerCase() === "true") {
      const sms = await sendBillingDelivery(invoice.id, "reminder", "sms");
      smsStatus = sms.status;
    }
    if (email.status === "sent") {
      sent += 1;
      const stamp = new Date().toISOString();
      await supabase.from("chillbros_invoices").update({ last_reminder_at: stamp, reminder_count: Number(invoice.reminder_count ?? 0) + 1, updated_at: stamp }).eq("id", invoice.id);
      await supabase.from("chillbros_workflow_events").insert({ job_id: invoice.job_id, invoice_id: invoice.id, stage: "automatic_payment_reminder", message: "Automatic billing reminder sent to customer." });
    } else if (email.status !== "skipped") failed += 1;
    details.push({ id: invoice.id, email: email.status, sms: smsStatus });
  }
  return Response.json({ ok: true, checked: (data ?? []).length, sent, failed, intervalHours, details });
}
