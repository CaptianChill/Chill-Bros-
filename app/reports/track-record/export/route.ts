import { trackRecordCsv } from "@/lib/chillbros/track-record";
import { getTrackRecord } from "@/lib/chillbros/track-record-queries";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const profile = await getCurrentStaffProfile();
  if (!profile || profile.role !== "manager") return new Response("Owner access required.", { status: 403 });
  const record = await getTrackRecord();
  const stamp = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(new Date());
  return new Response(trackRecordCsv(record), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="chill-pros-invoice-ledger-${stamp}.csv"`,
      "cache-control": "no-store",
    },
  });
}
