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

export default async function RevenueRadarPage() {
  const profile = await getCurrentStaffProfile();
  if (!profile || !["manager", "office"].includes(profile.role)) redirect("/");

  const client = createServiceRoleClient();
  let prospectsQuery = client
    .from("chillbros_revenue_prospects")
    .select("id,business_name,city,category,service_line,signal_summary,signal_verified,signal_observed_at,score,status,follow_up_at,estimated_revenue,actual_revenue,direct_cost,business_address,contact_phone,contact_email,contact_name,contact_role,verification_status,source_url,assigned_salesperson,sales_status")
    .order("score", { ascending: false });
  if (profile.role === "office") prospectsQuery = prospectsQuery.eq("assigned_salesperson", profile.id);
  // A hard cap here silently drops any lead ranked below it once the table
  // passes that many rows, however new or recent it is — this previously sat
  // at 100 and cut off real leads with the table already past that size.
  const { data, error } = await prospectsQuery.limit(1000);

  const prospects = data ?? [];
  const newCount = prospects.filter((p) => p.status === "new").length;
  const highPriority = prospects.filter((p) => Number(p.score) >= 65).length;

  return <AppShell title="Revenue Radar" description={profile.role === "office" ? "Your assigned Revenue Radar leads, sales follow-up, and next actions." : "New leads first. Open one to work it and lock it in."}>
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

      {profile.role === "manager" ? <div className="flex flex-wrap gap-2 text-xs">
        <Link href="/revenue-radar/opportunities" className="rounded-full border border-cyan-300/30 px-3 py-1.5 text-cyan-100 hover:border-cyan-300/60">Sales pipeline & closeout →</Link>
      </div> : null}

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
