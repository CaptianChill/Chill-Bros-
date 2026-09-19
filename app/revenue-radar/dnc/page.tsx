import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import { createServiceRoleClient } from "@/lib/supabase/service-client";
import { reverseRevenueDoNotContact } from "../dnc-actions";

export const dynamic = "force-dynamic";
const field = "min-h-11 w-full rounded-xl border border-cyan-400/30 bg-black/50 px-3 py-2 text-white";

export default async function RevenueDncPage() {
  const profile = await getCurrentStaffProfile();
  if (!profile || profile.role !== "manager") redirect("/");

  const client = createServiceRoleClient();
  const { data: leads, error } = await client
    .from("chillbros_revenue_prospects")
    .select("id,business_name,city,service_line,score,do_not_contact_reason,sales_status,status_reason,updated_at")
    .or("do_not_contact.eq.true,sales_status.eq.do_not_contact")
    .order("updated_at", { ascending: false })
    .limit(100);

  if (error) {
    return <AppShell title="Do Not Contact Review" description="Manager-only Revenue Radar contact restriction review.">
      <div className="mx-auto max-w-5xl space-y-4 text-left">
        <Link href="/revenue-radar" className="text-cyan-200">← Revenue Radar</Link>
        <p className="rounded-2xl border border-amber-300/30 bg-amber-400/5 p-4 text-sm text-amber-100">
          Do Not Contact review is waiting for the additive Sales Command migration. Existing Revenue Radar remains available.
        </p>
      </div>
    </AppShell>;
  }

  return <AppShell title="Do Not Contact Review" description="Manager-only review. Restrictions stay in force until documented evidence supports reversal.">
    <div className="mx-auto max-w-5xl space-y-4 text-left">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/revenue-radar" className="text-cyan-200">← Revenue Radar</Link>
        <span className="rounded-full border border-red-300/25 px-3 py-1 text-xs text-red-200">{leads?.length ?? 0} restricted leads</span>
      </div>

      <section className="rounded-2xl border border-red-300/20 bg-red-400/5 p-4 text-sm text-zinc-300">
        Reversal requires manager approval plus documented evidence that outreach is permitted again. The original restriction remains preserved in Activity History.
      </section>

      <div className="space-y-3">
        {(leads ?? []).map((lead) => <article key={lead.id} className="rounded-2xl border border-red-300/20 bg-black/35 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <Link href={`/revenue-radar/${lead.id}`} className="text-lg font-bold text-white underline decoration-white/20 underline-offset-2">{lead.business_name}</Link>
              <p className="mt-1 text-sm text-zinc-400">{lead.city} · {String(lead.service_line).replaceAll("_", " ")} · {lead.score}/100</p>
            </div>
            <span className="rounded-full border border-red-300/30 px-3 py-1 text-xs font-semibold text-red-100">Do Not Contact</span>
          </div>

          <p className="mt-3 rounded-xl border border-red-300/15 bg-red-400/5 p-3 text-sm text-red-100">
            <span className="font-semibold">Recorded reason:</span> {lead.do_not_contact_reason || lead.status_reason || "No reason recorded"}
          </p>

          <form action={reverseRevenueDoNotContact} className="mt-4 grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="lead_id" value={lead.id} />
            <label className="sm:col-span-2">Evidence outreach is permitted again
              <textarea className={`${field} resize-y`} name="evidence" required minLength={10} rows={3} placeholder="Document the customer request, written permission, corrected record, or other evidence." />
            </label>
            <label>Restore pipeline status
              <select className={field} name="restore_status" defaultValue="nurture">
                <option value="nurture">Nurture</option>
                <option value="qualified">Qualified</option>
              </select>
            </label>
            <div className="flex items-end">
              <button className="min-h-11 w-full rounded-xl border border-red-200/40 px-4 font-semibold text-red-50">Approve DNC Reversal</button>
            </div>
          </form>
        </article>)}

        {(leads ?? []).length === 0 ? <div className="rounded-2xl border border-white/10 p-6 text-center text-sm text-zinc-500">No Revenue Radar leads are currently restricted from contact.</div> : null}
      </div>
    </div>
  </AppShell>;
}
