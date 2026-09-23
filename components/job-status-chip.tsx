import { JOB_STATUS_LABELS, type JobStatus } from "@/lib/chillbros/types";

// Where a job is in the field, grouped the way the redesigned screens show it.
export const EN_ROUTE_STATUSES: JobStatus[] = ["dispatched", "en_route"];
export const ON_SITE_STATUSES: JobStatus[] = ["arrived", "in_progress", "diagnosing", "repairing"];

type ChipTone = "onSite" | "enRoute" | "scheduled" | "needsAction";

const TONES: Record<ChipTone, string> = {
  onSite: "bg-[#DDEEFF] text-[#0E3F82]",
  enRoute: "bg-[#C6ECFF] text-[#075985]",
  scheduled: "bg-[#E8EEF6] text-[#3A5A85]",
  needsAction: "bg-[#0B5CD5] text-white",
};

export function jobChip(status: JobStatus, assigned: boolean): { label: string; tone: ChipTone } {
  if (ON_SITE_STATUSES.includes(status)) return { label: "On site", tone: "onSite" };
  if (EN_ROUTE_STATUSES.includes(status)) return { label: "En route", tone: "enRoute" };
  if (!assigned && !["paid", "completed", "cancelled"].includes(status)) return { label: "Unassigned", tone: "needsAction" };
  return { label: JOB_STATUS_LABELS[status] ?? status, tone: "scheduled" };
}

export function JobStatusChip({ status, assigned }: { status: JobStatus; assigned: boolean }) {
  const { label, tone } = jobChip(status, assigned);
  return <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold ${TONES[tone]}`}>{label}</span>;
}
