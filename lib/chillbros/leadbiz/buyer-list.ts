import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type BuyerListRow = { license: string; trade: string; name: string; phone: string | null; address: string | null; contact: string | null; status: string | null; note: string | null };

// Contractors (state lists) joined with saved call results. Paged: PostgREST caps each read at 1,000.
export async function loadBuyerList(client: SupabaseClient, trade?: string) {
  const rows: Omit<BuyerListRow, "status" | "note">[] = [];
  for (let from = 0; ; from += 1000) {
    let q = client.from("chillbros_leadbiz_contractors").select("license,trade,name,phone,address,contact").order("trade").order("name").range(from, from + 999);
    if (trade) q = q.eq("trade", trade);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  const calls = new Map<string, { status: string; note: string | null }>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await client.from("chillbros_leadbiz_calls").select("license,status,note").range(from, from + 999);
    if (error) throw new Error(error.message);
    for (const c of data ?? []) calls.set(c.license, c);
    if (!data || data.length < 1000) break;
  }
  return rows.map((r) => ({ ...r, status: calls.get(r.license)?.status ?? null, note: calls.get(r.license)?.note ?? null }));
}
