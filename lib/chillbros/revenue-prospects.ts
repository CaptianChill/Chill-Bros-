import type { createServiceRoleClient } from "@/lib/supabase/service-client";

const PROSPECT_COLUMNS = "id,business_name,city,category,service_line,signal_summary,signal_verified,signal_observed_at,score,status,follow_up_at,estimated_revenue,actual_revenue,direct_cost,business_address,contact_phone,contact_email,contact_name,contact_role,verification_status,source_url,assigned_salesperson,sales_status";
const PAGE_SIZE = 50;

// Keep responses small, but continue to the actual end of the queue. Never
// silently hide leads behind a fixed page count. Preserve office assignment scope.
export async function fetchAllProspects(client: ReturnType<typeof createServiceRoleClient>, role: string, profileId: string) {
  const selectProspects = () => client.from("chillbros_revenue_prospects").select(PROSPECT_COLUMNS);
  type Prospect = NonNullable<Awaited<ReturnType<typeof selectProspects>>["data"]>[number];
  const rows: Prospect[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    let query = selectProspects()
      .order("score", { ascending: false }).order("id", { ascending: true });
    if (role === "office") query = query.eq("assigned_salesperson", profileId);
    const { data, error } = await query.range(offset, offset + PAGE_SIZE - 1);
    if (error) return { data: rows, error };
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return { data: rows, error: null };
  }
}
