const SB_URL = "https://rbhtdgqpktocavxbiafw.supabase.co";
const SB_KEY = "sb_publishable_QmdOKzwUgIFM8MfZWdpeBw_8CefyFOz";

// Serves the live page (hq_asset_live -> 'index'). ?v=index_vN previews an unreleased version (not cached).
module.exports = async (req, res) => {
  try {
    const v = new URL(req.url, "http://x").searchParams.get("v") || "";
    const preview = /^index_v\d{1,3}$/.test(v);
    const r = await fetch(`${SB_URL}/rest/v1/rpc/hq_asset`, {
      method: "POST",
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_name: preview ? v : "index" }),
    });
    const html = await r.json();
    if (!r.ok || typeof html !== "string") throw new Error("bad");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", preview ? "no-store" : "public, max-age=0, s-maxage=30, stale-while-revalidate=300");
    return res.status(200).send(html);
  } catch (e) {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(503).send("<!doctype html><meta name=viewport content='width=device-width'><body style='background:#070b10;color:#e7eff5;font-family:system-ui;padding:24px'><h2>Chill Pros HQ</h2><p>Couldn't load right now. Pull down to refresh.</p>");
  }
};
