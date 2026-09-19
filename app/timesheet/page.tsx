import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { ManagerTimesheetAdmin } from "@/components/manager-timesheet-admin";
import { SectionCard } from "@/components/section-card";
import { TimesheetPanel } from "@/components/timesheet-panel";
import { getManagerStaffCalls, getOpenTimesheet, getTimekeepingStaff, getTimesheetHistory } from "@/lib/chillbros/operations-queries";
import { getCurrentStaffProfile } from "@/lib/neon/data-api/auth-server";

export const dynamic = "force-dynamic";

export default async function TimesheetPage() {
  const profile = await getCurrentStaffProfile();
  if (!profile) redirect("/sign-in");

  if (profile.role === "manager") {
    const [rows, staff, calls] = await Promise.all([getTimesheetHistory(250), getTimekeepingStaff(), getManagerStaffCalls(250)]);
    return (
      <AppShell title="Team Time & Activity">
        <SectionCard title="Employee time, calls & notes">
          <ManagerTimesheetAdmin rows={rows} staff={staff} calls={calls} />
        </SectionCard>
      </AppShell>
    );
  }

  const open = await getOpenTimesheet(profile.id);
  return (
    <AppShell title="Timesheet">
      <SectionCard title="Daily time">
        <TimesheetPanel initialOpen={open} />
      </SectionCard>
    </AppShell>
  );
}
