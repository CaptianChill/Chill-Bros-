import { sourceCounts } from "@/lib/buyers";

export const dynamic = "force-dynamic";

// Counts per trade only (no names or phones): confirms the state license sources are reachable.
export async function GET() {
  return Response.json(await sourceCounts(), { headers: { "cache-control": "no-store" } });
}
