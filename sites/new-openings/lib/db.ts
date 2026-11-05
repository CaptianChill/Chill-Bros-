import "server-only";

// Talks to the database only through two locked-down functions (no service key in this site).
async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T | null> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  try {
    const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify(args),
      cache: "no-store",
    });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

export type PublicStats = { openings: number; ready: number };
export const publicStats = async () => (await rpc<PublicStats>("leadbiz_public_stats")) ?? { openings: 16, ready: 230 };

export type Dashboard = {
  buyers: { business_name: string; trade: string; email: string | null; status: string; emailed_at: string | null; followup_at: string | null; last_error: string | null }[];
  runs: { ran_at: string; result: Record<string, unknown> }[];
  ready: number;
  unsubscribed: number;
};
export const ownerDashboard = () => rpc<Dashboard>("leadbiz_owner_dashboard", { p_key: process.env.LEADBIZ_DB_KEY ?? "" });
