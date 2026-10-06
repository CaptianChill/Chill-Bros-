import { rejectUnlessBrae, noStore } from "@/lib/brae/auth";
import { getInvoiceCenterData } from "@/lib/chillbros/billing-queries";

export const dynamic = "force-dynamic";

/**
 * GET /api/brae/unpaid-invoices
 * Outstanding invoices (approved, issued, not paid) plus the Invoice Center
 * money summary. Uses the same rules as the Invoices screen. Read-only.
 */
export async function GET(request: Request) {
  const denied = rejectUnlessBrae(request);
  if (denied) return denied;

  const { rows, metrics } = await getInvoiceCenterData();
  const outstanding = rows
    .filter((row) => row.status === "approved" && row.paymentStatus !== "paid" && Boolean(row.issuedAt) && !row.convertedInvoiceId)
    .sort((a, b) => b.daysOverdue - a.daysOverdue)
    .map((row) => ({
      invoiceNumber: row.invoiceNumber,
      customer: row.customerName,
      total: Math.round(row.total * 100) / 100,
      dueAt: row.dueAt,
      daysOverdue: row.daysOverdue,
      aging: row.agingBucket,
      remindersSent: row.reminderCount,
      technician: row.technicianName,
      scope: row.jobScope,
    }));

  return Response.json(
    {
      ok: true,
      summary: {
        outstandingValue: Math.round(metrics.outstandingValue * 100) / 100,
        overdueValue: Math.round(metrics.overdueValue * 100) / 100,
        dueToday: metrics.dueToday,
        collectedThisMonth: Math.round(metrics.collectedThisMonth * 100) / 100,
        awaitingApproval: metrics.pendingApproval,
      },
      count: outstanding.length,
      invoices: outstanding,
    },
    noStore,
  );
}
