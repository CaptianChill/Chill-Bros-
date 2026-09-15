import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { getCustomers, getFeeSettings, getPartsCatalog, getPriceBookEntries } from "@/lib/chillbros/queries";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import { createDirectInvoiceAction } from "./actions";

export const dynamic = "force-dynamic";
type Props = { searchParams: Promise<{ type?: string; success?: string; error?: string; token?: string; invoice?: string; customer?: string }> };

const input = "min-h-12 w-full rounded-xl border border-[#2d7dff]/25 bg-black px-3 py-2.5 text-white placeholder:text-zinc-600";
const label = "text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400";

export default async function NewInvoicePage({ searchParams }: Props) {
  const profile = await getCurrentStaffProfile();
  if (!profile) redirect("/sign-in");
  if (profile.role !== "manager") redirect("/invoices");
  const params = await searchParams;
  const documentType = params.type === "quote" ? "quote" : "invoice";
  const isQuote = documentType === "quote";
  const [customers, parts, fees, priceBook] = await Promise.all([getCustomers(), getPartsCatalog(), getFeeSettings(), getPriceBookEntries()]);
  const selectedCustomerId = customers.some((customer) => customer.id === params.customer) ? String(params.customer) : "";

  return <AppShell title={isQuote ? "New Quote" : "New Invoice"} description="Create billing documents immediately. No open job or scheduled service call is required.">
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="grid gap-2 sm:grid-cols-2">
        <Link href="/invoices/new?type=quote" className={`rounded-2xl border px-4 py-3 text-center text-sm font-semibold ${isQuote ? "border-[#8ffafa]/60 bg-[#2d7dff]/20 text-white" : "border-[#2d7dff]/25 text-[#d9fbff]"}`}>Create Quote</Link>
        <Link href="/invoices/new?type=invoice" className={`rounded-2xl border px-4 py-3 text-center text-sm font-semibold ${!isQuote ? "border-[#8ffafa]/60 bg-[#2d7dff]/20 text-white" : "border-[#2d7dff]/25 text-[#d9fbff]"}`}>Create Invoice</Link>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href="/invoices" className="rounded-xl border border-[#2d7dff]/25 px-4 py-2 text-sm text-[#d9fbff]">Manage documents</Link>
        <Link href="/inventory" className="rounded-xl border border-[#2d7dff]/25 px-4 py-2 text-sm text-[#d9fbff]">Inventory / Price Book</Link>
        {!isQuote ? <Link href="/payments" className="rounded-xl border border-[#2d7dff]/25 px-4 py-2 text-sm text-[#d9fbff]">Payment Center</Link> : null}
      </div>

      {params.error ? <div className="rounded-2xl border border-rose-500/35 bg-rose-500/10 p-4 text-sm text-rose-200">{params.error}</div> : null}
      {params.success ? <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm text-emerald-100">
        <p className="font-semibold">{params.success}</p>
        {params.token ? <div className="mt-3 flex flex-wrap gap-2"><Link target="_blank" href={`/portal/${params.token}/document`} className="rounded-xl border border-emerald-400/30 px-3 py-2">Open / Print</Link><Link target="_blank" href={`/portal/${params.token}`} className="rounded-xl border border-emerald-400/30 px-3 py-2">Customer view</Link></div> : null}
      </div> : null}

      <form action={createDirectInvoiceAction} className="space-y-5" data-draft-key={`billing:${documentType}:${selectedCustomerId || "new"}`} data-draft-label={isQuote ? "New quote" : "New invoice"}>
        <input type="hidden" name="documentType" value={documentType} />
        <section className="rounded-3xl border border-[#2d7dff]/25 bg-black/45 p-4 sm:p-5">
          <h2 className="text-xl font-semibold text-white">1. Customer</h2>
          <p className="mt-1 text-sm text-zinc-400">Pick an existing customer or create one here. No job selection is required.</p>
          <div className="mt-4 space-y-3">
            <label className={label}>Customer database<select name="customerId" defaultValue={selectedCustomerId} className={`${input} mt-1`}><option value="">+ New customer</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}{customer.phone ? ` · ${customer.phone}` : ""}</option>)}</select></label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={label}>Customer / business name<input name="customerName" placeholder="Required only for a new customer" className={`${input} mt-1`} /></label>
              <label className={label}>Phone<input name="customerPhone" inputMode="tel" placeholder="Phone" className={`${input} mt-1`} /></label>
              <label className={label}>Email<input name="customerEmail" type="email" placeholder="Email" className={`${input} mt-1`} /></label>
              <label className={label}>Address<input name="customerAddress" placeholder="Billing / service address" className={`${input} mt-1`} /></label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={label}>Service location<input name="jobLocation" placeholder="Optional" className={`${input} mt-1`} /></label>
              <label className={label}>Description<input name="jobDescription" placeholder={isQuote ? "Quoted work / scope" : "Service performed / invoice description"} className={`${input} mt-1`} /></label>
            </div>
            <label className={label}>Work / scope notes<textarea name="workPerformed" rows={3} placeholder="Optional internal or customer-facing summary" className={`${input} mt-1 resize-y`} /></label>
          </div>
        </section>

        <section className="rounded-3xl border border-[#2d7dff]/25 bg-black/45 p-4 sm:p-5">
          <h2 className="text-xl font-semibold text-white">2. Items</h2>
          <p className="mt-1 text-sm text-zinc-400">Use inventory, service fees, or the master price book from the drop-down. Manual items still work when needed.</p>
          <div className="mt-4 space-y-3">
            {Array.from({ length: 8 }, (_, i) => <div key={i} className="rounded-2xl border border-[#2d7dff]/15 bg-zinc-950/65 p-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Line {i + 1}</div>
              <label className={label}>Inventory / Price Book<select name={`itemPreset${i}`} defaultValue="" className={`${input} mt-1`}>
                <option value="">Manual line item</option>
                {parts.length ? <optgroup label="Inventory parts">{parts.map((part) => <option key={part.id} value={`part:${part.id}`}>{part.name}{part.partNumber ? ` · ${part.partNumber}` : ""} · ${part.stock} in stock · ${part.retailPrice.toLocaleString("en-US", { style: "currency", currency: "USD" })}</option>)}</optgroup> : null}
                {fees.length ? <optgroup label="Service fees">{fees.map((fee) => <option key={fee.id} value={`fee:${fee.id}`}>{fee.label} · {fee.amount.toLocaleString("en-US", { style: "currency", currency: "USD" })}</option>)}</optgroup> : null}
                {priceBook.length ? <optgroup label="Master price book">{priceBook.map((entry) => <option key={entry.code} value={`pb:${entry.code}`}>{entry.category} · {entry.title} · {entry.currentValue.toLocaleString("en-US", { style: "currency", currency: "USD" })}</option>)}</optgroup> : null}
              </select></label>
              <div className="mt-2 grid gap-2 sm:grid-cols-[1.5fr_90px_130px]">
                <input name={`itemLabel${i}`} placeholder="Manual item name if no preset is selected" className={input} />
                <input name={`itemQty${i}`} type="number" min="0" step="0.01" defaultValue={i === 0 ? "1" : ""} placeholder="Qty" className={input} />
                <input name={`itemPrice${i}`} type="number" min="0" step="0.01" placeholder="Manual price" className={input} />
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
                <input name={`itemDescription${i}`} placeholder="Optional description / override" className={input} />
                <label className="flex min-h-12 items-center gap-2 rounded-xl border border-[#2d7dff]/20 px-3 text-sm text-zinc-300"><input name={`itemTaxable${i}`} type="checkbox" /> Taxable</label>
              </div>
            </div>)}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className={label}>Discount $<input name="discount" type="number" min="0" step="0.01" defaultValue="0" className={`${input} mt-1`} /></label>
            <label className={label}>Sales tax %<input name="taxRate" type="number" min="0" max="25" step="0.001" defaultValue="8.25" className={`${input} mt-1`} /></label>
          </div>
          <label className={`${label} mt-3 block`}>Customer notes<textarea name="notes" rows={3} placeholder="Warranty, terms, thank-you note, exclusions, etc." className={`${input} mt-1 resize-y`} /></label>
        </section>

        {!isQuote ? <section className="rounded-3xl border border-emerald-400/25 bg-emerald-500/[0.04] p-4 sm:p-5">
          <h2 className="text-xl font-semibold text-white">3. Payment</h2>
          <p className="mt-1 text-sm text-zinc-400">Leave unpaid or record a completed non-card payment immediately. Card checkout stays disabled until you intentionally configure it.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className={label}>Payment status<select name="paymentStatus" defaultValue="unpaid" className={`${input} mt-1`}><option value="unpaid">Unpaid</option><option value="paid">Paid now</option></select></label>
            <label className={label}>Payment method<select name="paymentMethod" defaultValue="" className={`${input} mt-1`}><option value="">Choose method</option><option value="cash">Cash</option><option value="check">Check</option><option value="ach">ACH / bank transfer</option><option value="cash_app">Cash App</option><option value="venmo">Venmo</option><option value="zelle">Zelle</option></select></label>
            <label className={label}>Payment terms<select name="paymentTerms" defaultValue="due_on_receipt" className={`${input} mt-1`}><option value="due_on_receipt">Due on receipt</option><option value="net_7">Net 7</option><option value="net_15">Net 15</option><option value="net_30">Net 30</option><option value="custom">Custom due date</option></select></label>
            <label className={label}>Custom due date<input name="customDueDate" type="date" className={`${input} mt-1`} /></label>
            <label className={label}>Payer name<input name="payerName" placeholder="Name on payment" className={`${input} mt-1`} /></label>
            <label className={label}>Confirmation / check #<input name="paymentReference" placeholder="Transaction, check, confirmation" className={`${input} mt-1`} /></label>
            <label className={`${label} sm:col-span-2`}>Payment notes<input name="paymentNotes" placeholder="Optional internal payment note" className={`${input} mt-1`} /></label>
          </div>
          <p className="mt-3 text-xs text-zinc-500">Debit/credit cards and Apple Pay are intentionally hidden until online card processing is configured.</p>
        </section> : null}

        <button type="submit" className="min-h-14 w-full rounded-2xl border border-[#8ffafa]/60 bg-[#2d7dff]/20 px-5 py-3 text-lg font-semibold text-white shadow-[0_0_20px_rgba(45,125,255,0.18)]">Create {isQuote ? "Quote" : "Invoice"}</button>
      </form>
    </div>
  </AppShell>;
}
