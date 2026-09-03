import { AppShell } from "@/components/app-shell";
import { SectionCard } from "@/components/section-card";
import { TimesheetPanel } from "@/components/timesheet-panel";
import { StatusPill } from "@/components/status-pill";


export const dynamic = "force-dynamic";

export default function TimesheetPage() {
  return (
    <AppShell
      title="Mobile-first timesheets for labor, drive time, and technician clock events."
      description="This page keeps time entry streamlined for field use, with a simple location tag, labor versus drive allocation, and one-tap clock actions in the same branded system."
      highlight={
        <div className="space-y-3">
          <p className="text-sm uppercase tracking-[0.3em] text-[#8ffafa]">Field ready</p>
          <StatusPill tone="emerald">Single-screen mobile form</StatusPill>
          <StatusPill>Clock-in / clock-out</StatusPill>
          <StatusPill>Labor + drive split</StatusPill>
        </div>
      }
    >
      <SectionCard eyebrow="Technician time capture" title="Daily mobile timesheet" description="Optimized for fast entry during active service days without leaving the core workflow.">
        <TimesheetPanel />
      </SectionCard>
    </AppShell>
  );
}
