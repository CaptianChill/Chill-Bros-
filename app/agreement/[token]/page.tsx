import { notFound } from "next/navigation";

import { PortalShell } from "@/components/portal-shell";
import { SectionCard } from "@/components/section-card";
import { ServiceAgreementClientActions } from "@/components/service-agreement-client-actions";
import { StatusPill } from "@/components/status-pill";
import { getServiceAgreementByToken } from "@/lib/chillbros/service-agreement-queries";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ token: string }> };
const money = (value: number) => value.toLocaleString("en-US", { style: "currency", currency: "USD" });
const date = (value: string | null) => value ? new Date(`${value}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Open-ended";

export default async function AgreementPage({ params }: Props) {
  const { token } = await params;
  const agreement = await getServiceAgreementByToken(token);
  if (!agreement) notFound();

  return <PortalShell
    title={agreement.title}
    description="Your custom Chill Bros monthly service plan, built around the schedule, hours, services, and pricing requested for your location."
    highlight={<div className="space-y-3"><p className="text-sm uppercase tracking-[0.3em] text-[#8ffafa]">Agreement status</p><StatusPill tone={agreement.status === "active" || agreement.status === "accepted" ? "emerald" : "amber"}>{agreement.status}</StatusPill><p className="text-sm text-zinc-300">{agreement.agreementNumber}</p><p className="text-sm text-zinc-300">Customer: {agreement.customerName}</p></div>}
  >
    <div className="grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
      <div className="space-y-4">
        <SectionCard eyebrow="Monthly plan" title="Service schedule & scope" description="The recurring schedule and service coverage included in this proposal.">
          <div className="grid gap-3 sm:grid-cols-2"><Info label="Visits per month" value={String(agreement.visitsPerMonth)} /><Info label="Hours per visit" value={`${agreement.hoursPerVisit} hr`} /><Info label="Preferred days" value={agreement.preferredDays.length ? agreement.preferredDays.join(", ") : "Flexible"} /><Info label="Preferred time" value={agreement.preferredTimeWindow ?? "Flexible"} /><Info label="Start date" value={date(agreement.startDate)} /><Info label="End date" value={agreement.endDate ? date(agreement.endDate) : "Open-ended"} /></div>
          {agreement.servicesIncluded ? <TextBlock label="Services included" value={agreement.servicesIncluded} /> : null}
          {agreement.customerPreferences ? <TextBlock label="Customer preferences" value={agreement.customerPreferences} /> : null}
          {agreement.terms ? <TextBlock label="Plan terms" value={agreement.terms} /> : null}
        </SectionCard>

        <SectionCard eyebrow="Customer" title={agreement.customerName} description="Plan contact and service location information.">
          <div className="grid gap-3 sm:grid-cols-2"><Info label="Address" value={agreement.customerAddress ?? "Not provided"} /><Info label="Phone" value={agreement.customerPhone ?? "Not provided"} /><Info label="Email" value={agreement.customerEmail ?? "Not provided"} /></div>
        </SectionCard>
      </div>

      <div className="space-y-4">
        <SectionCard eyebrow="Pricing" title="Monthly service investment" description="Pricing shown below is calculated from the saved plan preferences.">
          <div className="space-y-3 text-sm"><Price label={agreement.calculationMode === "hourly" ? `${agreement.visitsPerMonth} visits × ${agreement.hoursPerVisit} hr × ${money(agreement.hourlyRate)}` : "Flat monthly service rate"} value={money(agreement.monthlySubtotal)} />{agreement.discountAmount > 0 ? <Price label={agreement.discountType === "percent" ? `Discount (${agreement.discountValue}%)` : "Discount"} value={`−${money(agreement.discountAmount)}`} accent /> : null}<div className="flex items-center justify-between border-t border-[#2d7dff]/25 pt-3 text-lg font-semibold"><span>Monthly total</span><span className="text-[#bafcfc]">{money(agreement.monthlyTotal)}</span></div>{agreement.setupFee > 0 ? <Price label="One-time setup / onboarding" value={money(agreement.setupFee)} /> : null}</div>
        </SectionCard>

        <SectionCard eyebrow="Approval" title="Review and accept" description="Open the printable version or accept the saved plan here.">
          <ServiceAgreementClientActions agreement={agreement} />
        </SectionCard>
      </div>
    </div>
  </PortalShell>;
}

function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-[#2d7dff]/15 bg-black/40 p-3"><p className="text-xs uppercase tracking-[0.14em] text-zinc-500">{label}</p><p className="mt-1 text-sm text-white">{value}</p></div>; }
function TextBlock({ label, value }: { label: string; value: string }) { return <div className="mt-3 rounded-xl border border-[#2d7dff]/15 bg-black/40 p-4"><p className="text-xs uppercase tracking-[0.14em] text-zinc-500">{label}</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-200">{value}</p></div>; }
function Price({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) { return <div className={`flex items-start justify-between gap-4 ${accent ? "text-emerald-200" : "text-zinc-300"}`}><span>{label}</span><span className="font-medium">{value}</span></div>; }
