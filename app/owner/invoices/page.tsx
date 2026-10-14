import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, FileDown, Search } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { getOwnerProfile, getSentInvoiceHistory, STATE_LABEL, type SentInvoiceRow } from "@/lib/chillbros/sent-invoice-history";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ q?: string; view?: string }> };

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const VIEWS = [["invoices", "Invoices"], ["quotes", "Quotes"], ["unpaid", "Unpaid"], ["paid", "Paid"], ["void", "Voided"], ["all", "Everything"]] as const;

function date(value: string | null) {
  return value ? new Date(value).toLocaleDateString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", year: "numeric" }) : "—";
}


function matches(row: SentInvoiceRow, view: string, query: string) {
  const viewMatch = view === "all" ? true
    : view === "invoices" ? row.kind === "invoice" && row.state !== "void"
    : view === "quotes" ? row.kind === "quote" && row.state !== "void"
    : view === "unpaid" ? row.kind === "invoice" && row.state === "unpaid"
    : view === "paid" ? row.state === "paid"
    : view === "void" ? row.state === "void"
    : true;
  if (!viewMatch) return false;
  if (!query) return true;
  return [row.invoiceNumber, row.customerName, row.customerEmail].filter(Boolean).join(" ").toLowerCase().includes(query);
}

export default async function SentInvoiceHistoryPage({ searchParams }: Props) {
  if (!(await getOwnerProfile())) redirect("/");
  const params = await searchParams;
  const view = VIEWS.some(([value]) => value === params.view) ? String(params.view) : "invoices";
  const query = String(params.q ?? "").trim().toLowerCase();

  let rows: SentInvoiceRow[] = [];
  let loadError: string | null = null;
  try { rows = await getSentInvoiceHistory(); } catch (error) { loadError = error instanceof Error ? error.message : "Unknown error"; }

  const shown = rows.filter((row) => matches(row, view, query));
  const invoices = rows.filter((row) => row.kind === "invoice" && row.state !== "void");
  const billed = invoices.reduce((sum, row) => sum + row.total, 0);
  const collected = invoices.filter((row) => row.state === "paid").reduce((sum, row) => sum + row.total, 0);

  return (
    <AppShell title="Sent Invoices" description="A copy of every quote and invoice that went out to a customer, newest first. Voided ones are kept here too.">
      <div className="space-y-4 text-left">
        <Link href="/owner" className="inline-block text-sm text-zinc-400">← Owner Control Center</Link>

        {loadError ? <p role="alert" className="rounded-2xl border border-rose-400/40 bg-rose-500/10 p-3 text-sm text-rose-100">Sent invoice history could not load. Nothing was deleted — refresh to try again. ({loadError})</p> : null}

        <div className="grid grid-cols-3 gap-2">
          {[["Invoices sent", String(invoices.length)], ["Billed", money.format(billed)], ["Collected", money.format(collected)]].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-[#2d7dff]/20 bg-black/40 p-3 text-center">
              <p className="text-xs text-zinc-500">{label}</p>
              <p className="mt-1 text-lg font-semibold text-white">{value}</p>
            </div>
          ))}
        </div>

        <SectionCard title="Find a sent invoice">
          <form action="/owner/invoices" method="get" className="flex gap-2">
            <input type="hidden" name="view" value={view} />
            <label className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-zinc-500" aria-hidden="true" />
              <input name="q" defaultValue={params.q ?? ""} placeholder="Customer or invoice #" className="w-full rounded-xl border border-[#2d7dff]/20 bg-zinc-950 py-2.5 pl-10 pr-3 text-white" />
            </label>
            <button className="rounded-xl border border-[#2d7dff]/30 px-4 py-2.5 text-sm text-[#d9fbff]">Search</button>
          </form>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {VIEWS.map(([value, label]) => (
              <Link key={value} href={`/owner/invoices?view=${value}${query ? `&q=${encodeURIComponent(query)}` : ""}`} className={`rounded-full border px-3 py-1.5 text-xs ${view === value ? "border-[#8ffafa]/60 bg-[#2d7dff]/20 text-white" : "border-[#2d7dff]/20 text-zinc-400"}`}>{label}</Link>
            ))}
          </div>
        </SectionCard>

        <SectionCard title={`${shown.length} sent document${shown.length === 1 ? "" : "s"}`}>
          {shown.length ? (
            <ul className="space-y-2 text-left">
              {shown.map((row) => {
                const state = STATE_LABEL[row.state];
                return (
                  <li key={row.id} className={`rounded-2xl border border-[#2d7dff]/20 bg-zinc-950/75 ${row.state === "void" ? "opacity-60" : ""}`}>
                    <div className="flex items-center gap-2 p-3">
                      <Link href={`/owner/invoices/${row.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-500">{row.kind === "quote" ? "Quote" : "Invoice"} · {row.invoiceNumber}</p>
                          <p className="truncate font-semibold text-white">{row.customerName}</p>
                          <p className="text-xs text-zinc-400">Sent {date(row.firstSentAt)}{row.sendCount > 1 ? ` · ${row.sendCount} sends` : ""}{row.paidAt ? ` · Paid ${date(row.paidAt)}` : ""}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="font-semibold text-[#bafcfc]">{money.format(row.total)}</p>
                          <div className="mt-1"><StatusPill tone={state.tone}>{state.label}</StatusPill></div>
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden="true" />
                      </Link>
                      {row.archiveStages.length ? (
                        <a href={`/owner/invoices/${row.id}/pdf`} target="_blank" rel="noreferrer" aria-label={`PDF copy of ${row.invoiceNumber}`} className="shrink-0 rounded-xl border border-[#2d7dff]/25 p-2 text-[#d9fbff]"><FileDown className="h-4 w-4" /></a>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : <p className="text-sm text-zinc-400">Nothing sent in this view yet.</p>}
        </SectionCard>
      </div>
    </AppShell>
  );
}
