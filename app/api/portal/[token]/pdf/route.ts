import { getArchivedPdfByToken, type ArchiveStage } from "@/lib/chillbros/invoice-pdf";

type Context = { params: Promise<{ token: string }> };

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: Context) {
  const { token } = await params;
  const stageParam = new URL(request.url).searchParams.get("stage");
  const stage: ArchiveStage | null = stageParam === "approved" || stageParam === "paid" ? stageParam : null;
  const archived = await getArchivedPdfByToken(token, stage);
  if (!archived) return new Response("Archived PDF not found.", { status: 404, headers: { "Cache-Control": "no-store" } });
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
