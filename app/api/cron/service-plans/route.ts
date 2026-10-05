import { generateAllActivePlans } from "@/lib/chillbros/service-plan-generation";

export const dynamic = "force-dynamic";

// Daily: make sure every active service plan has this month's visits and invoice.
// Each plan-month runs once (ledger in customer service history).
export async function GET(request: Request) {
  const secret = String(process.env.CRON_SECRET || "");
  const auth = request.headers.get("authorization") || "";
  if (!secret || auth !== `Bearer ${secret}`) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const result = await generateAllActivePlans();
  return Response.json(result, { status: result.ok ? 200 : 500 });
}
