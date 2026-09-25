import Link from "next/link";
import type { ReactNode } from "react";
import { BadgeCheck, CalendarClock, Camera, ClipboardList, FileDown, FileText, History, MapPin, ReceiptText, Wrench } from "lucide-react";

import { PortalCard } from "@/components/customer-portal/portal-frame";
import type { PortalEquipmentHistory } from "@/lib/chillbros/portal-queries";

export type PortalTab = "overview" | "photos" | "equipment";

export type PortalViewData = {
  token: string;
  documentLabel: "Estimate" | "Invoice";
  documentNumber: string;
  customerName: string;
  serviceAddress: string | null;
  statusLabel: string;
  statusTone: "success" | "attention" | "neutral";
  headline: string;
  subline: string;
  amountLabel: string;
  amount: number;
  dueLabel: string | null;
  scheduledLabel: string | null;
  lines: { id: string; label: string; description: string | null; quantity: number; unitPrice: number; amount: number }[];
  totals: { label: string; value: number; tone?: "success" | "attention" }[];
  notes: string | null;
  canOpenPdf: "approved" | "paid" | null;
  hasReceipt: boolean;
  beforePhotos: { id: string; url: string | null }[];
  afterPhotos: { id: string; url: string | null }[];
  history: PortalEquipmentHistory;
};

const money = (value: number) => value.toLocaleString("en-US", { style: "currency", currency: "USD" });
const day = (value: string) => new Date(value).toLocaleDateString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", year: "numeric" });

const TONE = {
  success: "bg-[#E6F6EC] text-[#11663A] ring-[#B7E3C8]",
  attention: "bg-[#FFF4DC] text-[#7A4A00] ring-[#F3D48B]",
  neutral: "bg-[#E8EEF6] text-[#1F3B63] ring-[#C7D3E2]",
} as const;

function Tabs({ token, active, photoCount, hasEquipment }: { token: string; active: PortalTab; photoCount: number; hasEquipment: boolean }) {
  const tabs: { key: PortalTab; label: string; icon: typeof ClipboardList }[] = [
    { key: "overview", label: "Overview", icon: ClipboardList },
    { key: "photos", label: `Photos${photoCount ? ` (${photoCount})` : ""}`, icon: Camera },
    { key: "equipment", label: hasEquipment ? "Equipment history" : "Equipment", icon: History },
  ];
  return (
    <nav aria-label="Document sections" className="grid grid-cols-3 gap-1 rounded-xl bg-[#E3EAF3] p-1">
      {tabs.map(({ key, label, icon: Icon }) => (
        <Link
          key={key}
          href={key === "overview" ? `/portal/${token}` : `/portal/${token}?tab=${key}`}
          aria-current={active === key ? "page" : undefined}
          scroll={false}
          className={`flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-2 text-center text-[13px] font-semibold leading-tight sm:text-sm ${active === key ? "bg-white text-[#0A1A33] shadow-sm" : "text-[#3D5170] hover:text-[#0A1A33]"}`}
        >
          <Icon className="hidden h-4 w-4 shrink-0 sm:block" aria-hidden="true" />
          {label}
        </Link>
      ))}
    </nav>
  );
}

function PhotoGrid({ title, photos }: { title: string; photos: { id: string; url: string | null }[] }) {
  const shown = photos.filter((photo) => photo.url);
  return (
    <div>
      <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-[#4A5B74]">{title}</h3>
      {shown.length ? (
        <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {shown.map((photo, index) => (
            <li key={photo.id}>
              <a href={photo.url!} target="_blank" rel="noreferrer" className="block aspect-[4/3] overflow-hidden rounded-xl border border-[#D5DEEA] bg-[#F3F6FA]" aria-label={`Open ${title.toLowerCase()} ${index + 1} full size`}>
                {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL from the private bucket */}
                <img src={photo.url!} alt={`${title} ${index + 1}`} loading="lazy" className="h-full w-full object-cover" />
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-[#4A5B74]">No {title.toLowerCase()} for this visit.</p>
      )}
    </div>
  );
}

function EquipmentHistory({ history }: { history: PortalEquipmentHistory }) {
  const unit = history.equipment;
  if (!unit) {
    return (
      <PortalCard className="p-5">
        <div className="flex items-start gap-3">
          <Wrench className="mt-0.5 h-5 w-5 shrink-0 text-[#1557B0]" aria-hidden="true" />
          <div>
            <h2 className="text-lg font-bold">Equipment history</h2>
            <p className="mt-1 text-sm leading-6 text-[#4A5B74]">No unit is linked to this service yet. Once your technician records the unit&apos;s model and serial number, every visit on it will appear here.</p>
          </div>
        </div>
      </PortalCard>
    );
  }
  const specs = [
    ["Manufacturer", unit.manufacturer],
    ["Model", unit.model],
    ["Serial number", unit.serialNumber],
    ["Refrigerant", unit.refrigerant],
    ["Asset tag", unit.assetTag],
  ].filter(([, value]) => value) as [string, string][];
  return (
    <div className="space-y-4">
      <PortalCard className="p-5">
        <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#1557B0]">Your unit</p>
        <h2 className="mt-1 text-xl font-bold">{unit.label}</h2>
        <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {specs.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-3 border-b border-[#EDF1F6] pb-2 text-sm">
              <dt className="text-[#4A5B74]">{label}</dt>
              <dd className="break-all text-right font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
      </PortalCard>
      <PortalCard className="p-5">
        <h2 className="text-lg font-bold">Service history ({history.visits.length})</h2>
        <ol className="mt-3 space-y-0">
          {history.visits.map((visit, index) => (
            <li key={visit.jobId} className="relative pl-6 pb-5 last:pb-0">
              {index < history.visits.length - 1 ? <span className="absolute left-[7px] top-4 h-full w-0.5 bg-[#D5DEEA]" aria-hidden="true" /> : null}
              <span className={`absolute left-0 top-1.5 h-4 w-4 rounded-full ring-4 ring-white ${visit.isCurrent ? "bg-[#1557B0]" : "bg-[#9FB3CC]"}`} aria-hidden="true" />
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <p className="font-bold">{day(visit.date)}{visit.isCurrent ? <span className="ml-2 rounded-full bg-[#DCEBFF] px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-[#1557B0]">This visit</span> : null}</p>
                {visit.documentNumber || visit.jobNumber ? <p className="text-[13px] text-[#4A5B74]">{visit.documentNumber ?? `Job ${visit.jobNumber}`}</p> : null}
              </div>
              <p className="mt-0.5 text-sm font-semibold">{visit.summary}</p>
              {visit.workPerformed ? <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-[#3D5170]">{visit.workPerformed}</p> : null}
              {visit.items.length ? <p className="mt-1 text-[13px] text-[#4A5B74]">Parts &amp; services: {visit.items.join(" · ")}</p> : null}
            </li>
          ))}
        </ol>
      </PortalCard>
    </div>
  );
}

/**
 * Customer portal page body. `actions` is the approve / pay block (client
 * components), passed in so this view stays plain and previewable.
 */
export function PortalView({ data, tab, actions, banner }: { data: PortalViewData; tab: PortalTab; actions: ReactNode; banner?: ReactNode }) {
  const photoCount = data.beforePhotos.length + data.afterPhotos.length;
  return (
    <div className="space-y-4">
      {banner}

      <PortalCard className="overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#EDF1F6] px-5 py-4">
          <div className="min-w-0">
            <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#1557B0]">{data.documentLabel} {data.documentNumber}</p>
            <h1 className="mt-1 text-2xl font-bold leading-tight sm:text-[28px]">{data.customerName}</h1>
            {data.serviceAddress ? <p className="mt-1 flex items-start gap-1.5 text-sm text-[#4A5B74]"><MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{data.serviceAddress}</p> : null}
          </div>
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-bold ring-1 ${TONE[data.statusTone]}`}>
            {data.statusTone === "success" ? <BadgeCheck className="h-4 w-4" aria-hidden="true" /> : null}
            {data.statusLabel}
          </span>
        </div>
        <div className="grid gap-4 px-5 py-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <p className="text-lg font-semibold">{data.headline}</p>
            <p className="mt-1 text-sm leading-6 text-[#4A5B74]">{data.subline}</p>
            {data.scheduledLabel ? <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-[#1557B0]"><CalendarClock className="h-4 w-4" aria-hidden="true" />{data.scheduledLabel}</p> : null}
          </div>
          <div className="rounded-xl bg-[#0A1A33] px-5 py-3 text-white sm:text-right">
            <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#9FD3FF]">{data.amountLabel}</p>
            <p className="text-3xl font-bold tabular-nums">{money(data.amount)}</p>
            {data.dueLabel ? <p className="text-[13px] text-[#C9DCF5]">{data.dueLabel}</p> : null}
          </div>
        </div>
      </PortalCard>

      <Tabs token={data.token} active={tab} photoCount={photoCount} hasEquipment={Boolean(data.history.equipment)} />

      {tab === "overview" ? (
        <>
          <PortalCard className="p-5">{actions}</PortalCard>

          <PortalCard className="overflow-hidden">
            <h2 className="border-b border-[#EDF1F6] px-5 py-3 text-lg font-bold">Work &amp; pricing</h2>
            {data.notes ? <p className="whitespace-pre-wrap border-b border-[#EDF1F6] bg-[#F8FAFD] px-5 py-3 text-sm leading-6 text-[#3D5170]">{data.notes}</p> : null}
            <ul className="divide-y divide-[#EDF1F6]">
              {data.lines.map((line) => (
                <li key={line.id} className="flex items-start justify-between gap-4 px-5 py-3">
                  <div className="min-w-0">
                    <p className="font-semibold [overflow-wrap:anywhere]">{line.label}</p>
                    {line.description ? <p className="text-[13px] text-[#4A5B74] [overflow-wrap:anywhere]">{line.description}</p> : null}
                    <p className="text-[13px] text-[#4A5B74]">{line.quantity} × {money(line.unitPrice)}</p>
                  </div>
                  <p className="shrink-0 font-semibold tabular-nums">{money(line.amount)}</p>
                </li>
              ))}
            </ul>
            <dl className="space-y-1.5 border-t border-[#D5DEEA] bg-[#F8FAFD] px-5 py-4 text-sm">
              {data.totals.map((row, index) => (
                <div key={row.label} className={`flex justify-between gap-4 ${index === data.totals.length - 1 ? "pt-1 text-lg font-bold" : ""} ${row.tone === "success" ? "text-[#11663A]" : row.tone === "attention" ? "text-[#7A4A00]" : ""}`}>
                  <dt>{row.label}</dt>
                  <dd className="tabular-nums">{money(row.value)}</dd>
                </div>
              ))}
            </dl>
          </PortalCard>

          <div className="grid gap-2 sm:grid-cols-3">
            <Link href={`/portal/${data.token}/document`} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#C7D3E2] bg-white px-3 text-sm font-semibold text-[#0A1A33] hover:border-[#1557B0]"><FileText className="h-4 w-4" aria-hidden="true" />Printable {data.documentLabel.toLowerCase()}</Link>
            {data.canOpenPdf ? <Link href={`/api/portal/${data.token}/pdf?stage=${data.canOpenPdf}`} target="_blank" className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#C7D3E2] bg-white px-3 text-sm font-semibold text-[#0A1A33] hover:border-[#1557B0]"><FileDown className="h-4 w-4" aria-hidden="true" />Download PDF</Link> : null}
            {data.hasReceipt ? <Link href={`/portal/${data.token}/receipt`} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#B7E3C8] bg-[#E6F6EC] px-3 text-sm font-semibold text-[#11663A]"><ReceiptText className="h-4 w-4" aria-hidden="true" />Payment receipt</Link> : null}
          </div>
        </>
      ) : null}

      {tab === "photos" ? (
        <PortalCard className="space-y-5 p-5">
          <PhotoGrid title="Before photos" photos={data.beforePhotos} />
          <PhotoGrid title="After photos" photos={data.afterPhotos} />
        </PortalCard>
      ) : null}

      {tab === "equipment" ? <EquipmentHistory history={data.history} /> : null}
    </div>
  );
}
