"use client";

import { useState } from "react";
import { PlatformShell } from "@/components/platform-shell";
import s from "@/components/platform-shell.module.css";

const views = {
  Owner: { title: "Your business, at a glance.", description: "A clear view of service, customers, and what needs your attention.", nav: ["Overview", "Schedule", "Customers", "Quotes & invoices", "Service plans", "Team"], metrics: [["Scheduled today", "8", "Across your service team"], ["Awaiting approval", "3", "Quotes ready for a decision"], ["Outstanding invoices", "$4,280", "Follow up in one place"]], heading: "Today's service", rows: [["9:00 AM · Refrigeration service", "Example restaurant · Walk-in cooler", "Scheduled"], ["11:30 AM · Maintenance visit", "Example customer · Rooftop unit", "In progress"], ["2:00 PM · Equipment inspection", "Example kitchen · Reach-in freezer", "Scheduled"]], aside: "Needs attention", detail: "3 quotes awaiting approval", note: "Keep work moving", body: "Quotes, invoices, service plans, and team tools use the same clear layout." },
  Employee: { title: "Ready for the day.", description: "Your schedule, job details, and field tools, together in one place.", nav: ["Overview", "My schedule", "Jobs", "Field notes", "Time"], metrics: [["Assigned today", "3", "Your service visits"], ["Current shift", "Not started", "Clock in when you are ready"], ["Notes to finish", "1", "Complete your job record"]], heading: "Your next visits", rows: [["9:00 AM · Refrigeration service", "Example restaurant · Walk-in cooler", "Assigned"], ["11:30 AM · Maintenance visit", "Example customer · Rooftop unit", "Scheduled"], ["2:00 PM · Equipment inspection", "Example kitchen · Reach-in freezer", "Scheduled"]], aside: "Job essentials", detail: "Equipment, history, and notes", note: "Built for the field", body: "Readable job information and consistent controls, on your phone or at your desk." },
  Customer: { title: "We've got you covered.", description: "Your service visits, equipment, and documents. All in one place.", nav: ["Overview", "Service visits", "Quotes & invoices", "Equipment", "Service plans"], metrics: [["Next visit", "Nov 4", "Maintenance · 9:00–11:00 AM"], ["Quote to review", "1", "View your recommended work"], ["Service plan", "Active", "Your equipment, looked after"]], heading: "Your service activity", rows: [["Preventive maintenance", "Nov 4 · Example location", "Scheduled"], ["Walk-in cooler repair", "Oct 28 · Example location", "Completed"], ["Equipment inspection", "Oct 12 · Example location", "Completed"]], aside: "Your next step", detail: "A quote is ready to review", note: "Service without the stress", body: "Request service, find equipment history, and manage your service plan with familiar controls." },
} as const;

export function InterfacePreview({ initialRole = "Owner" }: { initialRole?: keyof typeof views }) {
  const [role, setRole] = useState<keyof typeof views>(initialRole);
  const [page, setPage] = useState("Overview");
  const view = views[role];
  return <PlatformShell audience={`${role} workspace`} title={page === "Overview" ? view.title : page} description={view.description} onNavigate={setPage} accountLabel="Design preview"
    navigation={view.nav.map(label => ({ label, href: `#${label.toLowerCase().replaceAll(/[^a-z]+/g, "-")}`, active: label === page }))}>
    <div className={s.toolbar} aria-label="Preview workspace">{(Object.keys(views) as (keyof typeof views)[]).map(name => <button type="button" key={name} aria-pressed={role === name} onClick={() => {setRole(name);setPage("Overview");}}>{name}</button>)}<span className={s.status}>Sample content</span></div>
    <div className={s.stats}>{view.metrics.map(([label, value, hint]) => <section key={label} className={s.card}><p>{label}</p><strong className={s.statValue}>{value}</strong><p>{hint}</p></section>)}</div>
    <div className={s.grid}>
      <section className={s.card}><div className={s.sectionHeading}><h2>{view.heading}</h2><span>Sample schedule</span></div>{view.rows.map(([title, subtitle, status]) => <div className={s.row} key={title}><div><strong>{title}</strong><p>{subtitle}</p></div><span className={s.status}>{status}</span></div>)}</section>
      <section className={s.card}><h2>{view.aside}</h2><div className={s.row}><strong>{view.detail}</strong></div><div className={s.note}><strong>{view.note}</strong><p>{view.body}</p></div><div className={s.toolbar} style={{ marginTop: 20 }}>{view.nav.slice(1, 4).map(label => <button type="button" key={label} onClick={() => setPage(label)}>{label}</button>)}</div></section>
    </div>
    {page !== "Overview" ? <div className={s.note} role="status"><strong>{page} layout preview</strong><p>This shell is ready for the existing {page.toLowerCase()} workflow. The information above is illustrative.</p></div> : null}
    <p className={s.notice}>Interface concept · Sample information only · Workspace switching previews appearance and does not change account permissions.</p>
  </PlatformShell>;
}
