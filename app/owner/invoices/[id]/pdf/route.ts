import { getOwnerArchivedPdf, getOwnerProfile } from "@/lib/chillbros/sent-invoice-history";

type Context = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

// Owner-only: serves the archived PDF copy by invoice id, including voided
// documents (the public portal PDF route hides those from customers).
export async function GET(request: Request, { params }: Context) {
  if (!(await getOwnerProfile())) return new Response("Not found.", { status: 404, headers: { "Cache-Control": "no-store" } });
  const { id } = await params;
  const archived = await getOwnerArchivedPdf(id, new URL(request.url).searchParams.get("stage"));
  if (!archived) return new Response("No PDF copy was archived for this document.", { status: 404, headers: { "Cache-Control": "no-store" } });
  return new Response(new Uint8Array(archived.buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${archived.filename.replace(/[^a-zA-Z0-9._-]/g, "-")}"`,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      "X-Archive-SHA256": archived.sha256,
    },
  });
}
