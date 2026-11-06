import { deliveryCsv, loadDelivery } from "@/lib/chillbros/leadbiz/delivery";

export const dynamic = "force-dynamic";

// Spreadsheet download for one delivery; same token check (and revocation) as the page.
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const d = await loadDelivery(token);
  if (!d) return new Response("This link isn't active.", { status: 404, headers: { "Cache-Control": "private, no-store" } });
  const name = `${d.productName.replace(/[^A-Za-z0-9]+/g, "_")}_${d.trade}.csv`;
  return new Response(deliveryCsv(d), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
