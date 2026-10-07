import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service-client";
import { rankCustomerParts, type PartUse } from "@/lib/chillbros/customer-parts-rank";

type Row = { part_id: string | null; quantity: number | null; job: { customer_id: string | null } | { customer_id: string | null }[] | null };

// Parts each customer's equipment has used before, most-used first. Read-only.
// Powers the "Used on this customer's equipment" group at the top of parts pickers.
export async function getCustomerPartIds(customerId?: string | null): Promise<Record<string, string[]>> {
  const supabase = createServiceRoleClient();
  let query = supabase.from("chillbros_job_parts").select("part_id,quantity,job:chillbros_jobs!inner(customer_id)").limit(5000);
  if (customerId) query = query.eq("job.customer_id", customerId);
  const { data, error } = await query;
  if (error || !data) return {};
  const uses: PartUse[] = (data as Row[]).map((row) => {
    const job = Array.isArray(row.job) ? row.job[0] : row.job;
    return { customerId: job?.customer_id ?? null, partId: row.part_id, quantity: Number(row.quantity ?? 1) };
  });
  return rankCustomerParts(uses);
}
