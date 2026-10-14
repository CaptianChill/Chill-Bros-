import "server-only";

import type { SentInvoiceRow } from "./sent-invoice-history";

/**
 * Read-only: invoices the owner sent straight from Square (Square Invoices),
 * so they show on the owner's Sent invoices page next to the app's own.
 *
 * Only calls Square's list-invoices endpoint (GET). It never creates, changes,
 * or charges anything, and it does not touch the frozen payment path.
 */

const API_VERSION = "2025-01-23";

type SquareMoney = { amount?: number; currency?: string };
type SquareInvoice = {
  id: string;
  invoice_number?: string;
  title?: string;
  status?: string;
  public_url?: string;
  created_at?: string;
  updated_at?: string;
  delivery_method?: string;
  primary_recipient?: { given_name?: string; family_name?: string; company_name?: string; email_address?: string };
  payment_requests?: { computed_amount_money?: SquareMoney; total_completed_amount_money?: SquareMoney }[];
};

export type SquareSentInvoiceRow = SentInvoiceRow & { source: "square"; externalUrl: string | null; title: string | null; deliveredBy: string | null };

function config() {
  const accessToken = String(process.env.SQUARE_ACCESS_TOKEN || "").trim();
  const locationId = String(process.env.SQUARE_LOCATION_ID || "").trim();
  const sandbox = String(process.env.SQUARE_ENVIRONMENT || "").trim().toLowerCase() === "sandbox";
  return { accessToken, locationId, base: sandbox ? "https://connect.squareupsandbox.com" : "https://connect.squareup.com" };
}

function stateOf(status: string | undefined): SentInvoiceRow["state"] {
  if (status === "PAID" || status === "REFUNDED" || status === "PARTIALLY_REFUNDED") return "paid";
  if (status === "CANCELED" || status === "FAILED") return "void";
  return "unpaid";
}

function toRow(invoice: SquareInvoice): SquareSentInvoiceRow {
  const recipient = invoice.primary_recipient ?? {};
  const person = [recipient.given_name, recipient.family_name].filter(Boolean).join(" ").trim();
  const total = (invoice.payment_requests ?? []).reduce((sum, request) => sum + Number(request.computed_amount_money?.amount ?? 0), 0) / 100;
  const state = stateOf(invoice.status);
  return {
    id: `square:${invoice.id}`,
    invoiceNumber: `SQ-${invoice.invoice_number || invoice.id.slice(-6)}`,
    kind: "invoice",
    customerName: recipient.company_name ? (person ? `${person} (${recipient.company_name})` : recipient.company_name) : person || "Square customer",
    customerEmail: recipient.email_address ?? null,
    total,
    state,
    firstSentAt: invoice.created_at ?? null,
    lastSentAt: invoice.created_at ?? null,
    sendCount: 1,
    paidAt: state === "paid" ? invoice.updated_at ?? null : null,
    archiveStages: [],
    source: "square",
    externalUrl: invoice.public_url ?? null,
    title: invoice.title?.trim() || null,
    deliveredBy: invoice.delivery_method === "SMS" ? "text" : invoice.delivery_method === "EMAIL" ? "email" : null,
  };
}

/** Square-sent invoices, drafts excluded. Returns an error message instead of throwing so the page still loads. */
export async function getSquareSentInvoices(): Promise<{ rows: SquareSentInvoiceRow[]; error: string | null }> {
  const { accessToken, locationId, base } = config();
  if (!accessToken || !locationId) return { rows: [], error: "Square isn't set up in the app's settings, so Square invoices can't be shown." };

  const invoices: SquareInvoice[] = [];
  let cursor: string | undefined;
  try {
    for (let page = 0; page < 10; page += 1) {
      const query = new URLSearchParams({ location_id: locationId, limit: "200" });
      if (cursor) query.set("cursor", cursor);
      const response = await fetch(`${base}/v2/invoices?${query}`, {
        headers: { Authorization: `Bearer ${accessToken}`, "Square-Version": API_VERSION },
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) {
        console.error("[sent-invoice-square] list invoices failed", response.status);
        return { rows: [], error: response.status === 401 || response.status === 403 ? "Square didn't allow reading invoices with the app's current Square key." : `Square invoices couldn't load (Square error ${response.status}).` };
      }
      const body = (await response.json()) as { invoices?: SquareInvoice[]; cursor?: string };
      invoices.push(...(body.invoices ?? []));
      cursor = body.cursor;
      if (!cursor) break;
    }
  } catch (error) {
    console.error("[sent-invoice-square] list invoices error", error instanceof Error ? error.message : error);
    return { rows: [], error: "Square invoices couldn't load right now. Refresh to try again." };
  }

  return { rows: invoices.filter((invoice) => invoice.status !== "DRAFT").map(toRow), error: null };
}
