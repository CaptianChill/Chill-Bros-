import { notFound } from "next/navigation";

import { DocumentToolbar } from "@/components/document-toolbar";
import { LogoBadge } from "@/components/logo-badge";
import { getServiceAgreementByToken } from "@/lib/chillbros/service-agreement-queries";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ token: string }> };
const money = (value: number) => value.toLocaleString("en-US", { style: "currency", currency: "USD" });
const date = (value: string | null) => value ? new Date(`${value}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Open-ended";

export default async function AgreementDocumentPage({ params }: Props) {
  const { token } = await params;
  const agreement = await getServiceAgreementByToken(token);
  if (!agreement) notFound();

  return <main className="min-h-screen bg-white px-3 py-4 text-zinc-950 sm:px-6 sm:py-8 print:p-0">
    <div className="mx-auto max-w-4xl">
      <DocumentToolbar invoiceNumber={agreement.agreementNumber} returnHref={`/agreement/${agreement.portalToken}`} backLabel="Back to plan" />
      <article className="overflow-hidden rounded-2xl border border-zinc-300 bg-white shadow-xl print:rounded-none print:border-0 print:shadow-none">
        <header className="border-b border-zinc-200 bg-[#020407] px-6 py-5 text-white sm:px-8"><div className="flex flex-wrap items-center justify-between gap-5"><div className="flex items-center gap-3"><LogoBadge variant="full" className="w-14" /><div><p className="text-2xl font-bold tracking-wide">CHILL BROS</p><p className="text-xs uppercase tracking-[0.24em] text-cyan-100">Monthly Service Agreement</p></div></div><div className="text-right"><p className="text-sm font-semibold tracking-[0.18em] text-cyan-100">SERVICE PLAN</p><p className="mt-1 text-lg font-bold">{agreement.agreementNumber}</p><p className="mt-1 text-xs uppercase text-zinc-300">{agreement.status}</p></div></div></header>

        <div className="space-y-6 p-6 sm:p-8">
          <section className="grid gap-4 border-b border-zinc-200 pb-5 sm:grid-cols-2"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Customer</p><p className="mt-1 text-xl font-semibold">{agreement.customerName}</p><p className="mt-1 text-sm text-zinc-600">{agreement.customerAddress ?? "Address not provided"}</p>{agreement.customerEmail ? <p className="mt-1 text-sm text-zinc-600">{agreement.customerEmail}</p> : null}{agreement.customerPhone ? <p className="mt-1 text-sm text-zinc-600">{agreement.customerPhone}</p> : null}</div><div className="sm:text-right"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Plan</p><p className="mt-1 text-lg font-semibold">{agreement.title}</p><p className="mt-1 text-sm text-zinc-600">Start: {date(agreement.startDate)}</p><p className="text-sm text-zinc-600">End: {agreement.endDate ? date(agreement.endDate) : "Open-ended"}</p></div></section>

          <section><h2 className="text-sm font-bold uppercase tracking-[0.16em] text-zinc-700">Recurring service schedule</h2><div className="mt-3 grid gap-3 sm:grid-cols-2"><Info label="Visits per month" value={String(agreement.visitsPerMonth)} /><Info label="Hours per visit" value={`${agreement.hoursPerVisit} hour${agreement.hoursPerVisit === 1 ? "" : "s"}`} /><Info label="Preferred days" value={agreement.preferredDays.length ? agreement.preferredDays.join(", ") : "Flexible"} /><Info label="Preferred time" value={agreement.preferredTimeWindow ?? "Flexible"} /></div></section>

          {agreement.servicesIncluded ? <DocBlock title="Services included" text={agreement.servicesIncluded} /> : null}
          {agreement.customerPreferences ? <DocBlock title="Customer preferences / site requirements" text={agreement.customerPreferences} /> : null}

          <section><h2 className="text-sm font-bold uppercase tracking-[0.16em] text-zinc-700">Pricing</h2><div className="mt-3 ml-auto max-w-md space-y-2 text-sm"><div className="flex justify-between"><span className="text-zinc-600">{agreement.calculationMode === "hourly" ? `${agreement.visitsPerMonth} visits × ${agreement.hoursPerVisit} hr × ${money(agreement.hourlyRate)}` : "Flat monthly service rate"}</span><span>{money(agreement.monthlySubtotal)}</span></div>{agreement.discountAmount > 0 ? <div className="flex justify-between text-emerald-700"><span>Discount{agreement.discountType === "percent" ? ` (${agreement.discountValue}%)` : ""}</span><span>−{money(agreement.discountAmount)}</span></div> : null}<div className="flex justify-between border-t border-zinc-400 pt-2 text-lg font-bold"><span>Monthly total</span><span>{money(agreement.monthlyTotal)}</span></div>{agreement.setupFee > 0 ? <div className="flex justify-between"><span className="text-zinc-600">One-time setup / onboarding</span><span>{money(agreement.setupFee)}</span></div> : null}</div></section>

          {agreement.terms ? <DocBlock title="Agreement terms" text={agreement.terms} /> : null}

          <section className="grid gap-6 border-t border-zinc-200 pt-5 sm:grid-cols-2"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Customer acceptance</p><p className="mt-3 text-sm">Signed by: <span className="font-semibold">{agreement.signatureName ?? "Pending"}</span></p>{agreement.signedAt ? <p className="mt-1 text-xs text-zinc-500">Accepted {new Date(agreement.signedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</p> : <div className="mt-8 border-b border-zinc-500" />} </div><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Chill Bros</p><p className="mt-3 text-sm">Operational service plan prepared for {agreement.customerName}.</p><div className="mt-8 border-b border-zinc-500" /></div></section>
        </div>
      </article>
    </div>
  </main>;
}

function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">{label}</p><p className="mt-1 text-sm font-medium text-zinc-900">{value}</p></div>; }
function DocBlock({ title, text }: { title: string; text: string }) { return <section className="rounded-xl bg-zinc-50 p-4"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">{title}</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-700">{text}</p></section>; }
