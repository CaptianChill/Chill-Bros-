import "server-only";

import { getInvoiceV2ById } from "@/lib/chillbros/invoice-v2";
import { createServiceRoleClient } from "@/lib/supabase/service-client";

export type PayType = "hourly" | "piece";
export type StaffPaySetting = { profileId: string; fullName: string; role: string; payType: PayType; pieceRate: number };
export type PieceLine = { key: string; label: string; customerPays: number; suggestedCost: number };
export type SavedPiecePay = {
  id: string; invoiceId: string; technicianId: string; technicianName: string; revenue: number; costTotal: number; kept: number;
  rate: number; calculatedPay: number; payAmount: number; lineCosts: { key: string; label: string; cost: number }[];
  isCallback: boolean; notes: string | null; status: "approved" | "paid"; approvedAt: string; paidAt: string | null;
  invoiceNumber: string; customerName: string;
};
export type PieceJob = {
  invoiceId: string; invoiceNumber: string; customerName: string; jobId: string | null; jobScope: string | null;
  assignedTechId: string | null; issuedAt: string | null; paymentStatus: string;
  lines: PieceLine[]; adjustments: { label: string; amount: number }[]; saved: SavedPiecePay[];
};

const num = (value: unknown) => Number(value ?? 0) || 0;

export async function getStaffPaySettings(): Promise<StaffPaySetting[]> {
  const supabase = createServiceRoleClient();
  const [{ data: profiles }, { data: settings }] = await Promise.all([
    supabase.from("chillbros_profiles").select("id,full_name,role").in("role", ["manager", "technician"]).order("full_name"),
    supabase.from("chillbros_tech_pay_settings").select("profile_id,pay_type,piece_rate"),
  ]);
  const byId = new Map((settings ?? []).map((row) => [row.profile_id, row]));
  return (profiles ?? []).map((p) => {
    const s = byId.get(p.id);
    return { profileId: p.id, fullName: p.full_name ?? "Staff", role: p.role, payType: (s?.pay_type === "piece" ? "piece" : "hourly") as PayType, pieceRate: s ? num(s.piece_rate) : 0.25 };
  });
}

function mapSaved(row: Record<string, unknown>, names: Map<string, string>, invoiceNumber: string, customerName: string): SavedPiecePay {
  return {
    id: String(row.id), invoiceId: String(row.invoice_id), technicianId: String(row.technician_id), technicianName: names.get(String(row.technician_id)) ?? "Technician",
    revenue: num(row.revenue), costTotal: num(row.cost_total), kept: num(row.kept), rate: num(row.rate), calculatedPay: num(row.calculated_pay), payAmount: num(row.pay_amount),
    lineCosts: Array.isArray(row.line_costs) ? (row.line_costs as SavedPiecePay["lineCosts"]) : [], isCallback: Boolean(row.is_callback), notes: (row.notes as string) ?? null,
    status: row.status === "paid" ? "paid" : "approved", approvedAt: String(row.approved_at), paidAt: (row.paid_at as string) ?? null, invoiceNumber, customerName,
  };
}

/** Finished jobs (issued invoices) from the last 120 days, ready to work out tech pay. */
export async function getPieceJobs(focusInvoiceId?: string | null): Promise<PieceJob[]> {
  const supabase = createServiceRoleClient();
  const since = new Date(Date.now() - 120 * 24 * 3600 * 1000).toISOString();
  let query = supabase.from("chillbros_invoices").select("id").eq("status", "approved").is("revoked_at", null).not("issued_at", "is", null).gte("issued_at", since).order("issued_at", { ascending: false }).limit(40);
  if (focusInvoiceId) query = supabase.from("chillbros_invoices").select("id").eq("id", focusInvoiceId).limit(1);
  const [{ data: rows }, { data: profiles }] = await Promise.all([query, supabase.from("chillbros_profiles").select("id,full_name")]);
  const names = new Map((profiles ?? []).map((p) => [p.id, p.full_name ?? "Staff"]));
  const ids = (rows ?? []).map((r) => r.id);
  if (!ids.length) return [];
  const { data: savedRows } = await supabase.from("chillbros_piece_pay").select("*").in("invoice_id", ids);

  const jobs = await Promise.all(ids.map(async (id) => {
    const invoice = await getInvoiceV2ById(id);
    if (!invoice) return null;
    const [{ data: job }, { data: parts }] = await Promise.all([
      invoice.jobId ? supabase.from("chillbros_jobs").select("assigned_tech_id,scope").eq("id", invoice.jobId).maybeSingle() : Promise.resolve({ data: null }),
      invoice.jobId ? supabase.from("chillbros_job_parts").select("quantity,part:chillbros_parts_catalog(name,part_number,default_cost)").eq("job_id", invoice.jobId) : Promise.resolve({ data: [] as never[] }),
    ]);
    const partCosts = (parts ?? []).map((row: { quantity: number; part: unknown }) => {
      const part = (Array.isArray(row.part) ? row.part[0] : row.part) as { name?: string; part_number?: string; default_cost?: number } | null;
      return { name: String(part?.name ?? "").toLowerCase(), number: String(part?.part_number ?? "").toLowerCase(), unitCost: num(part?.default_cost) };
    }).filter((p) => p.name);
    const lines: PieceLine[] = invoice.lineItems.map((item, index) => {
      const label = item.label.toLowerCase();
      const match = partCosts.find((p) => label.includes(p.name) || (p.number && label.includes(p.number)));
      return { key: `${index}:${item.label}`.slice(0, 120), label: item.label, customerPays: item.amount, suggestedCost: match ? Math.round(match.unitCost * item.quantity * 100) / 100 : 0 };
    });
    const adjustments = [
      invoice.discountAmount > 0 ? { label: "Discount", amount: -invoice.discountAmount } : null,
      invoice.creditAmount > 0 ? { label: "Credits", amount: -invoice.creditAmount } : null,
    ].filter(Boolean) as PieceJob["adjustments"];
    const saved = (savedRows ?? []).filter((r) => r.invoice_id === id).map((r) => mapSaved(r, names, invoice.invoiceNumber, invoice.customerName));
    return { invoiceId: id, invoiceNumber: invoice.invoiceNumber, customerName: invoice.customerName, jobId: invoice.jobId, jobScope: job?.scope ?? null, assignedTechId: job?.assigned_tech_id ?? null, issuedAt: invoice.issuedAt, paymentStatus: invoice.paymentStatus, lines, adjustments, saved } satisfies PieceJob;
  }));
  return jobs.filter(Boolean) as PieceJob[];
}

/** Approved pay not yet paid out, plus the last 30 paid. */
export async function getPiecePayLedger(): Promise<{ unpaid: SavedPiecePay[]; paid: SavedPiecePay[] }> {
  const supabase = createServiceRoleClient();
  const [{ data: unpaidRows }, { data: paidRows }, { data: profiles }] = await Promise.all([
    supabase.from("chillbros_piece_pay").select("*, invoice:chillbros_invoices(invoice_number, customer:chillbros_customers(name))").eq("status", "approved").order("approved_at", { ascending: true }).limit(200),
    supabase.from("chillbros_piece_pay").select("*, invoice:chillbros_invoices(invoice_number, customer:chillbros_customers(name))").eq("status", "paid").order("paid_at", { ascending: false }).limit(30),
    supabase.from("chillbros_profiles").select("id,full_name"),
  ]);
  const names = new Map((profiles ?? []).map((p) => [p.id, p.full_name ?? "Staff"]));
  const map = (row: Record<string, unknown>) => {
    const invoice = (Array.isArray(row.invoice) ? row.invoice[0] : row.invoice) as { invoice_number?: string; customer?: unknown } | null;
    const customer = (Array.isArray(invoice?.customer) ? invoice?.customer[0] : invoice?.customer) as { name?: string } | null;
    return mapSaved(row, names, invoice?.invoice_number ?? "—", customer?.name ?? "Customer");
  };
  return { unpaid: (unpaidRows ?? []).map(map), paid: (paidRows ?? []).map(map) };
}
