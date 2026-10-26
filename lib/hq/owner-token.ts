import "server-only";

/** Chill Pros HQ (where the Command Center now lives): its PIN sign-in token, checked against HQ's own database. */
const HQ_SUPABASE_URL = "https://rbhtdgqpktocavxbiafw.supabase.co";
const HQ_PUBLISHABLE_KEY = "sb_publishable_QmdOKzwUgIFM8MfZWdpeBw_8CefyFOz";
export async function hqOwner(token: string | null): Promise<boolean> {
  if (!token || token.length > 200) return false;
  try {
    const r = await fetch(`${HQ_SUPABASE_URL}/rest/v1/rpc/hq_whoami`, {
      method: "POST",
      headers: { apikey: HQ_PUBLISHABLE_KEY, Authorization: `Bearer ${HQ_PUBLISHABLE_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_token: token }),
      cache: "no-store",
    });
    return r.ok && (await r.json()) === "brae";
  } catch (error) {
    console.error("[hq-owner] hq sign-in check failed", error);
    return false;
  }
}
