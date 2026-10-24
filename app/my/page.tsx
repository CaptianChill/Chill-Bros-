import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarClock, Check, ChevronRight, Plus } from "lucide-react";

import { Card, CustomerFrame, money, shortDate } from "@/components/customer-account/customer-frame";
import { CustomerSignOutButton } from "@/components/customer-account/sign-out-button";
import { getCustomerSession } from "@/lib/chillbros/customer-account";
import { getCustomerHome, type HomeDocument, type HomeHistory } from "@/lib/chillbros/customer-home-queries";

export const dynamic = "force-dynamic";

const ACTION_TEXT: Record<HomeDocument["action"], string> = {
  pay: "Pay now",
  approve: "Review & approve",
  down_payment: "Pay deposit",
  view: "View",
};

const TONE = {
  blue: "bg-[#EAF3FF] text-[#1452C2]",
  amber: "bg-[#FFF4DC] text-[#7A4A00]",
  green: "bg-[#E6F6EC] text-[#11663A]",
};

// "walk in freezer" / "rang/oven" -> "Walk In Freezer" / "Rang/Oven" so typed CRM names read cleanly.
function titleCase(value: string) {
  return value.trim().replace(/\s+/g, " ").replace(/(^|[\s/-])([a-z])/g, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}

// Brand + model only, minus placeholder text like "n/a".
function brandModel(detail: string) {
  return detail.replace(/\b(n\/?a|none|unknown|tbd)\b/gi, "").replace(/\s+/g, " ").trim().replace(/^(\w)/, (c) => c.toUpperCase());
}

function compactDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleDateString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric" }) : "";
}

const HISTORY_PREVIEW = 4;

function monthDay(dateKey: string | null) {
  if (!dateKey) return null;
  const d = new Date(`${dateKey}T12:00:00`);
  return { m: d.toLocaleDateString("en-US", { month: "short" }).toUpperCase(), d: String(d.getDate()) };
}

export default async function CustomerHomePage({ searchParams }: { searchParams: Promise<{ requested?: string }> }) {
  const session = await getCustomerSession();
  if (!session) redirect("/my/sign-in");
  if (!session.customerIds.length) redirect("/my/welcome");

  const [home, query] = await Promise.all([getCustomerHome(session.customerIds), searchParams]);
  const primary = home.locations[0];
  // Repeat CRM records for the same customer collapse to one name on screen.
  const names = [...new Set(home.locations.map((l) => l.name.trim()))];
  const multi = names.length > 1;
  const accountName = multi ? `${names.length} locations` : primary?.name ?? session.email;
  // Balance alert: everything the customer can pay right now, oldest due first.
  const payable = home.due.filter((d) => d.action === "pay" || d.action === "down_payment").sort((a, b) => String(a.dueAt ?? "9999").localeCompare(String(b.dueAt ?? "9999")));
  const balance = payable.reduce((sum, d) => sum + d.amount, 0);
  const today = new Date().toISOString().slice(0, 10);
  const overdue = payable.filter((d) => d.dueAt && d.dueAt.slice(0, 10) < today).length;

  return (
    <CustomerFrame accountName={accountName} right={<CustomerSignOutButton />}>
      <section className="cb-frost relative -mx-4 -mt-5 overflow-hidden px-4 pb-5 pt-5 text-white sm:mx-0 sm:mt-0 sm:rounded-3xl sm:px-6 sm:pt-6">
        <Image src="/brand/chill-pros-ice-logo-240.png" alt="" width={240} height={240} aria-hidden="true" style={{ opacity: 0.1 }} className="pointer-events-none absolute -right-8 -top-6 h-36 w-36 sm:h-44 sm:w-44" />
        <p className="cb-display text-[13px] tracking-[0.2em] text-[#9CCBFF]">Welcome back</p>
        <h1 className="relative mt-0.5 text-[28px] font-bold leading-tight sm:text-[32px]">{primary?.name ?? "Hi there"}</h1>
        <p className="relative mt-0.5 truncate text-[14px] text-white/70">{multi ? names.join(" · ") : primary?.address ?? session.email}</p>

        <div className="relative mt-4 grid grid-cols-2 gap-3">
          <Link href="/my/request" className="flex h-[52px] min-w-0 items-center justify-center gap-2 rounded-2xl bg-[#1F6FEB] text-[15px] font-bold text-white shadow-[0_0_18px_rgba(31,111,235,0.6)] transition hover:bg-[#1a5fd0]">
            <Plus className="h-5 w-5 shrink-0" aria-hidden="true" />Request service
          </Link>
          <Link href="/book" className="flex h-[52px] min-w-0 items-center justify-center gap-2 rounded-2xl border-[1.5px] border-[#9CCBFF]/70 bg-white/10 text-[15px] font-bold text-white backdrop-blur transition hover:bg-white/15">
            <CalendarClock className="h-5 w-5 shrink-0" aria-hidden="true" />Pick a time
          </Link>
        </div>

        <div className="relative mt-4 grid grid-cols-3 divide-x divide-white/15 rounded-2xl border border-white/10 bg-white/[0.06] py-2.5 text-center">
          <Stat value={home.units.length} label="Units" />
          <Stat value={home.history.length} label="Visits" />
          <Stat value={home.upcoming.length} label="Upcoming" />
        </div>
      </section>

      {query.requested ? (
        <p role="status" className="mt-4 rounded-xl border border-[#B7E3C8] bg-[#E6F6EC] px-4 py-3 text-sm font-semibold text-[#11663A]">
          Request received{query.requested !== "1" ? ` (${query.requested})` : ""}. We&apos;ll contact you to confirm a time.
        </p>
      ) : null}

      {payable.length ? (
        <div role="alert" className={`mt-4 flex items-center justify-between gap-3 rounded-2xl border p-4 ${overdue ? "border-[#F2B8B5] bg-[#FDECEA]" : "border-[#F3D48B] bg-[#FFF8E8]"}`}>
          <div className="min-w-0">
            <p className={`text-sm font-bold uppercase tracking-[0.12em] ${overdue ? "text-[#8C1D18]" : "text-[#7A4A00]"}`}>{overdue ? "Past due" : "Balance due"}</p>
            <p className="text-2xl font-extrabold text-[#0B1220]">{money(balance)}</p>
            <p className="text-sm text-[#3D5170]">{payable.length === 1 ? `${payable[0].kind} ${payable[0].number}` : `${payable.length} invoices`}{overdue ? ` · ${overdue} past due` : ""}</p>
          </div>
          <Link href={`/portal/${payable[0].token}`} className="inline-flex h-12 shrink-0 items-center rounded-xl bg-[#05070A] px-5 text-base font-bold text-white">{payable.length === 1 ? "Pay now" : "Pay oldest"}</Link>
        </div>
      ) : null}

      <div className="mb-5" />

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="grid min-w-0 content-start gap-4">
          {home.due.length ? (
            <Card title="Needs your attention">
              <div className="space-y-2.5">
                {home.due.map((doc) => (
                  <div key={doc.id} className={`flex items-center justify-between gap-3 rounded-xl border p-3 ${doc.action === "approve" ? "border-[#C7D3E2] bg-[#F4F8FD]" : "border-[#F3D48B] bg-[#FFF8E8]"}`}>
                    <div className="min-w-0">
                      <p className="text-[15px] font-bold">{doc.kind} {doc.number}</p>
                      <p className="truncate text-sm text-[#3D5170]">{[doc.action === "pay" && doc.dueAt ? `Due ${shortDate(doc.dueAt)}` : null, doc.label ? doc.label.charAt(0).toUpperCase() + doc.label.slice(1) : null, multi ? doc.customerName : null].filter(Boolean).join(" · ")}</p>
                      <p className="text-lg font-extrabold">{money(doc.amount)}</p>
                    </div>
                    <Link href={`/portal/${doc.token}`} className={`inline-flex h-11 shrink-0 items-center rounded-xl px-4 text-[15px] font-bold ${doc.action === "approve" ? "border-[1.5px] border-[#0B1220] bg-white text-[#0B1220]" : "bg-[#05070A] text-white"}`}>
                      {ACTION_TEXT[doc.action]}
                    </Link>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}

          <Card title="Upcoming">
            {home.upcoming.length || home.plans.length ? (
              <ul>
                {home.upcoming.map((v) => {
                  const md = monthDay(v.dateKey);
                  return (
                    <li key={v.id} className="flex gap-3 border-t border-[#E6EEF8] py-3 first:border-t-0 first:pt-0">
                      <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-[#EAF3FF] text-[12px] font-extrabold leading-tight text-[#1F6FEB]">
                        {md ? (<><span>{md.m}</span><span className="text-[15px]">{md.d}</span></>) : <span className="text-[10px] tracking-wide">TBD</span>}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[15px] font-bold">{v.title}</p>
                        <p className="text-sm text-[#3D5170]">{[v.when, multi ? v.customerName : null, v.jobNumber].filter(Boolean).join(" · ") || "We'll call you to set a time"}</p>
                        <span className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${TONE[v.tone]}`}>{v.statusLabel}</span>
                      </div>
                    </li>
                  );
                })}
                {home.plans.map((p) => (
                  <li key={p.id} className="flex gap-3 border-t border-[#E6EEF8] py-3 first:border-t-0 first:pt-0">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#E6F6EC] text-[13px] font-extrabold text-[#11663A]">PM</div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-bold">{p.title}</p>
                      <p className="text-sm text-[#3D5170]">{[p.detail, multi ? p.customerName : null].filter(Boolean).join(" · ") || "Preventive maintenance plan"}</p>
                      <span className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${p.status === "Active" ? TONE.green : TONE.amber}`}>{p.status}</span>
                    </div>
                    {p.token ? <Link href={`/agreement/${p.token}`} className="self-center text-sm font-bold text-[#1452C2]">View</Link> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[15px] text-[#3D5170]">Nothing scheduled right now. Tap <span className="font-semibold text-[#0B1220]">Request service</span> any time you need us.</p>
            )}
          </Card>

          <Card title="Service history">
            {home.history.length ? (
              <>
                <ul>
                  {home.history.slice(0, HISTORY_PREVIEW).map((h) => <HistoryRow key={h.id} h={h} />)}
                </ul>
                {home.history.length > HISTORY_PREVIEW ? (
                  <details className="group">
                    <summary className="mt-1 cursor-pointer list-none py-2 text-center text-sm font-bold text-[#1452C2] [&::-webkit-details-marker]:hidden">
                      <span className="group-open:hidden">Show all {home.history.length} visits</span>
                      <span className="hidden group-open:inline">Show less</span>
                    </summary>
                    <ul>
                      {home.history.slice(HISTORY_PREVIEW).map((h) => <HistoryRow key={h.id} h={h} />)}
                    </ul>
                  </details>
                ) : null}
              </>
            ) : (
              <p className="text-[15px] text-[#3D5170]">Your completed visits will show here.</p>
            )}
          </Card>
        </div>

        <div className="grid min-w-0 content-start gap-4">
          <Card title="Your equipment">
            {home.units.length ? (
              <ul className="-mx-1">
                {home.units.map((u) => {
                  const brand = brandModel(u.detail);
                  return (
                    <li key={u.id} className="border-t border-[#E6EEF8] first:border-t-0">
                      <Link href={`/my/equipment/${u.id}`} className="flex min-w-0 items-center gap-3 rounded-lg px-1 py-2.5 active:bg-[#F4F8FD]">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[15px] font-bold leading-snug">{titleCase(u.name)}</p>
                          <p className="truncate text-[13px] leading-snug text-[#3D5170]">{[brand || null, multi ? u.customerName : null].filter(Boolean).join(" · ") || "Brand not on file"}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#6B7C96]">{u.lastService ? "Serviced" : "No visits"}</p>
                          <p className="text-[13px] font-semibold text-[#0B1220]">{u.lastService ? compactDate(u.lastService) : "—"}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-[#1F6FEB]" aria-hidden="true" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-[15px] text-[#3D5170]">We&apos;ll add your units here after our first visit.</p>
            )}
          </Card>

          {home.paid.length ? (
            <Card title="Invoices">
              <ul className="-mx-1">
                {home.paid.map((doc) => (
                  <li key={doc.id} className="border-t border-[#E6EEF8] first:border-t-0">
                    <Link href={`/portal/${doc.token}`} className="flex min-w-0 items-center gap-3 rounded-lg px-1 py-2.5 active:bg-[#F4F8FD]">
                      <div className="min-w-0 flex-1">
                        <p className="text-[17px] font-extrabold leading-snug tabular-nums">{money(doc.amount)}</p>
                        <p className="truncate text-[13px] leading-snug text-[#3D5170]">{[`#${doc.number}`, doc.paidAt ? shortDate(doc.paidAt) : null, multi ? doc.customerName : null].filter(Boolean).join(" · ")}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${TONE.green}`}>Paid</span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-[#1F6FEB]" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
      </div>
    </CustomerFrame>
  );
}

function HistoryRow({ h }: { h: HomeHistory }) {
  return (
    <li className="flex min-w-0 gap-3 border-t border-[#E6EEF8] py-2.5 first:border-t-0 first:pt-0">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#EAF3FF] text-[#1F6FEB]"><Check className="h-4 w-4" aria-hidden="true" /></div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-[14px] font-semibold leading-snug [overflow-wrap:anywhere]">{h.title}</p>
        <p className="truncate text-[13px] text-[#3D5170]">{[compactDate(h.date), h.unit ? titleCase(h.unit.split(" · ")[0]) : null].filter(Boolean).join(" · ")}</p>
      </div>
    </li>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <p className="text-[22px] font-extrabold leading-none tabular-nums">{value}</p>
      <p className="cb-display mt-1 text-[11px] tracking-[0.16em] text-[#9CCBFF]">{label}</p>
    </div>
  );
}
