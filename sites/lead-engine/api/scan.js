import { runScan, toCsv } from "./_engine.js";
import { PROFILES } from "./_profiles.js";

export default async function handler(req, res) {
  const url = new URL(req.url, "http://x");
  const key = process.env.LEAD_ENGINE_KEY;
  if (key && url.searchParams.get("key") !== key) return res.status(401).json({ error: "Missing or wrong key." });
  const profileId = url.searchParams.get("profile") ?? "auto_web";
  if (!PROFILES[profileId]) return res.status(400).json({ error: "Unknown profile", profiles: Object.keys(PROFILES) });
  const limit = Math.min(300, Number(url.searchParams.get("limit") ?? 60));
  const enrich = Math.min(150, Number(url.searchParams.get("enrich") ?? 90));
  try {
    const result = await runScan({ profileId, limit, enrich, budgetMs: Math.min(220000, Number(url.searchParams.get("budget") ?? 55) * 1000), includeChains: url.searchParams.get("chains") === "1" });
    res.setHeader("cache-control", "no-store");
    if (url.searchParams.get("format") === "csv") {
      res.setHeader("content-type", "text/csv; charset=utf-8");
      res.setHeader("content-disposition", `attachment; filename="${profileId}-${result.generatedAt.slice(0, 10)}.csv"`);
      return res.status(200).send(toCsv(result));
    }
    return res.status(200).json(result);
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }
}
