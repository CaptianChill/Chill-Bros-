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

  const { data, error } = await createServiceRoleClient()
    .from("chillbros_revenue_prospects")
    .select("id,business_name,city,category,service_line,signal_summary,signal_verified,signal_observed_at,score,status,follow_up_at,actual_revenue,direct_cost,business_address,contact_phone,contact_email")
    .order("score", { ascending: false })
    .limit(100);

  const prospects = data ?? [];
  const newCount = prospects.filter((p) => p.status === "new").length;
  const highPriority = prospects.filter((p) => Number(p.score) >= 65).length;

  return <AppShell title="Revenue Radar" description="Automatically discover commercial prospects, rank them, then review the best opportunities before outreach.">
    <div className="mx-auto max-w-5xl space-y-5 text-left">
      {error ? <p className="rounded-xl border border-amber-400 p-3 text-amber-200">Revenue Radar storage is not ready. {error.message}</p> : null}

      <section className="rounded-3xl border border-cyan-300/30 bg-cyan-400/5 p-5 shadow-[0_0_30px_rgba(34,211,238,0.08)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">Automatic lead generation</p>
            <h2 className="mt-1 text-2xl font-semibold text-white">Let Revenue Radar hunt for you.</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-300">
              Scan public commercial business data around San Antonio, identify businesses with strong HVAC/R, refrigeration, ice, and kitchen-equipment demand, remove duplicates, and rank the best prospects automatically.
            </p>
          </div>
          <ScanForLeadsButton action={scanForLeads} />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl border border-white/10 bg-black/30 p-3"><strong className="block text-xl text-white">{prospects.length}</strong><span className="text-xs text-zinc-400">On radar</span></div>
          <div className="rounded-2xl border border-white/10 bg-black/30 p-3"><strong className="block text-xl text-white">{newCount}</strong><span className="text-xs text-zinc-400">New</span></div>
          <div className="rounded-2xl border border-white/10 bg-black/30 p-3"><strong className="block text-xl text-cyan-200">{highPriority}</strong><span className="text-xs text-zinc-400">65+ score</span></div>
        </div>
      </section>

      <RevenueRadarList prospects={prospects} />

      <details className="rounded-2xl border border-white/10 bg-black/30 p-4">
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
      </details>
    </div>
  </AppShell>;
}
