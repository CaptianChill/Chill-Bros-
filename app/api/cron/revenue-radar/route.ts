import { createServiceRoleClient } from "@/lib/neon/data-api/service-client";
import { discoverSanAntonioRevenueLeads } from "@/lib/chillbros/revenue-discovery";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = String(process.env.CRON_SECRET || "");
  if (!secret) {
    return Response.json({ ok: false, error: "Cron secret is not configured." }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const discovered = await discoverSanAntonioRevenueLeads(80);
  if (!discovered.length) {
    return Response.json({ ok: true, discovered: 0, added: 0 });
  }

  const rows = discovered.map((lead) => ({
    ...lead,
    status: "new",
    created_by: null,
    updated_by: null,
    updated_at: new Date().toISOString(),
  }));

  const { data, error } = await createServiceRoleClient()
    .from("chillbros_revenue_prospects")
    .upsert(rows, { onConflict: "normalized_key", ignoreDuplicates: true })
    .select("id");

  if (error) {
    console.error("[revenue-radar-cron] lead upsert failed", error);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  return Response.json({
    ok: true,
    discovered: discovered.length,
    added: data?.length ?? 0,
    ranAt: new Date().toISOString(),
  });
}
