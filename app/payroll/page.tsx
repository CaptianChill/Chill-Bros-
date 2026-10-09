import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { PiecePayCalculator, PiecePayLedger, StaffPaySettings } from "@/components/piece-pay";
import { getPieceJobs, getPiecePayLedger, getStaffPaySettings } from "@/lib/chillbros/piece-pay";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";

const PAYROLL_APP_URL = "https://chill-pros-paystub-7t35dqu0p-chill-pros.vercel.app";
const money = (value: number) => value.toLocaleString("en-US", { style: "currency", currency: "USD" });

export const dynamic = "force-dynamic";

function SectionCard({ eyebrow, title, description, children }: { eyebrow: string; title: string; description?: string; children: ReactNode }) {
  return <section className="panel rounded-2xl border border-[#2d7dff]/20 bg-black/40 p-4 text-left">
    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#8ffafa]">{eyebrow}</p>
    <h2 className="mt-1 text-lg font-semibold text-white">{title}</h2>
    {description ? <p className="mt-1 text-sm text-zinc-400">{description}</p> : null}
    <div className="mt-3">{children}</div>
  </section>;
}
type Props = { searchParams: Promise<{ invoice?: string }> };

export default async function PayrollPage({ searchParams }: Props) {
  const profile = await getCurrentStaffProfile();
  if (!profile) redirect("/sign-in?next=%2Fpayroll");
  // Owner only — staff with the manager role (including technicians being paid) can't see or approve pay.
  if (profile.id !== "8c81f12a-ad86-4ceb-bca1-3924be1cbfec") redirect("/");
  const { invoice: focus } = await searchParams;
  const focusId = focus && /^[0-9a-f-]{36}$/i.test(focus) ? focus : null;

  const [staff, jobs, ledger] = await Promise.all([getStaffPaySettings(), getPieceJobs(focusId), getPiecePayLedger()]);
  const toDo = jobs.filter((j) => !j.saved.length);
  const done = jobs.filter((j) => j.saved.length);
  const owed = ledger.unpaid.reduce((s, r) => s + r.payAmount, 0);

  return <AppShell title="Payroll" description="Piece pay for technicians, approved job by job, plus paystubs and timesheets.">
    <div className="space-y-5">
      <SectionCard eyebrow="Owed now" title={owed > 0 ? `${money(owed)} approved, not paid yet` : "Nothing owed right now"} description="Approve each job's pay below. It collects here until you pay it out, then mark it paid.">
        <PiecePayLedger unpaid={ledger.unpaid} />
      </SectionCard>

      {focusId ? <SectionCard eyebrow="This job" title="Work out pay" description="Same math as your spreadsheet: what the customer paid, minus your parts and materials, times the tech's share.">
        {jobs.length ? jobs.map((job) => <PiecePayCalculator key={job.invoiceId} job={job} staff={staff} defaultOpen />) : <p className="text-sm text-zinc-400">This invoice isn&apos;t finished and issued yet, so there&apos;s no pay to work out.</p>}
        <Link href="/payroll" className="mt-3 inline-flex text-sm font-semibold text-[#d9fbff] underline">See all jobs</Link>
      </SectionCard> : <>
        <SectionCard eyebrow="To do" title={`${toDo.length} finished job${toDo.length === 1 ? "" : "s"} need pay worked out`} description="Open a job, enter what you paid for parts and materials, check the pay, and approve. Last 120 days.">
          {toDo.length ? <div className="space-y-3">{toDo.map((job) => <PiecePayCalculator key={job.invoiceId} job={job} staff={staff} />)}</div> : <p className="text-sm text-zinc-400">All caught up.</p>}
        </SectionCard>
        {done.length ? <SectionCard eyebrow="Approved" title="Jobs with pay approved" description="Open one to correct it before it's paid. Paid jobs are locked.">
          <div className="space-y-3">{done.map((job) => <PiecePayCalculator key={job.invoiceId} job={job} staff={staff} />)}</div>
        </SectionCard> : null}
      </>}

      <SectionCard eyebrow="Pay settings" title="How each person is paid" description="Piece pay = a share of what you keep after parts and materials. Discounts come out before their cut. Callbacks on their own work pay $0.">
        <StaffPaySettings staff={staff} />
        <p className="mt-3 text-xs text-zinc-500">If a technician is a W-2 employee, piece pay still has to work out to at least minimum wage for every hour worked, and overtime still applies. Have your accountant confirm the setup.</p>
      </SectionCard>

      {ledger.paid.length ? <SectionCard eyebrow="History" title="Recently paid" description="Last 30 piece-pay payouts.">
        <ul className="space-y-1 text-sm">{ledger.paid.map((r) => <li key={r.id} className="flex justify-between gap-3 text-zinc-300"><span className="min-w-0 truncate">{r.technicianName} · {r.invoiceNumber} · {r.customerName}</span><span className="shrink-0 text-white">{money(r.payAmount)}{r.paidAt ? ` · ${new Date(r.paidAt).toLocaleDateString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric" })}` : ""}</span></li>)}</ul>
      </SectionCard> : null}

      <SectionCard eyebrow="Paystubs" title="Paystubs & timesheets" description="Create and print paystubs in the payroll workspace. Hourly staff hours are in Timesheets.">
        <div className="flex flex-wrap gap-3">
          <a href={PAYROLL_APP_URL} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center rounded-xl border border-[#8ffafa]/60 bg-[#2d7dff]/20 px-4 py-2.5 text-sm font-semibold text-white">Open Paystub App</a>
          <Link href="/timesheet" className="inline-flex min-h-11 items-center rounded-xl border border-[#2d7dff]/25 bg-black/35 px-4 py-2.5 text-sm font-semibold text-[#d9fbff]">Review Timesheets</Link>
        </div>
      </SectionCard>
    </div>
  </AppShell>;
}
