import Link from "next/link";
import { redirect } from "next/navigation";
import { Check, ChevronRight, Plus } from "lucide-react";

import { Card, CustomerFrame, money, shortDate } from "@/components/customer-account/customer-frame";
import { CustomerSignOutButton } from "@/components/customer-account/sign-out-button";
import { getCustomerSession } from "@/lib/chillbros/customer-account";
import { getCustomerHome, type HomeDocument } from "@/lib/chillbros/customer-home-queries";

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
      <h1 className="text-[26px] font-bold leading-tight sm:text-[30px]">Hi, {multi ? primary?.name.split(" ")[0] ?? "there" : primary?.name ?? "there"}</h1>
      <p className="mt-1 text-[15px] text-[#3D5170]">{multi ? names.join(" · ") : primary?.address ?? session.email}</p>

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

      <Link href="/my/request" className="mt-4 mb-5 flex h-[58px] w-full items-center justify-center gap-2 rounded-2xl bg-[#1F6FEB] text-lg font-bold text-white shadow-[0_4px_14px_rgba(31,111,235,0.35)] transition hover:bg-[#1a5fd0]">
        <Plus className="h-5 w-5" aria-hidden="true" />Request service
      </Link>

      <div className="grid items-start gap-4 lg:grid-cols-[1.35fr_1fr]">
        <div className="grid content-start gap-4">
          {home.due.length ? (
            <Card title="Needs your attention">
              <div className="space-y-2.5">
                {home.due.map((doc) => (
                  <div key={doc.id} className={`flex items-center justify-between gap-3 rounded-xl border p-3 ${doc.action === "approve" ? "border-[#C7D3E2] bg-[#F4F8FD]" : "border-[#F3D48B] bg-[#FFF8E8]"}`}>
                    <div className="min-w-0">
                      <p className="text-[15px] font-bold">{doc.kind} {doc.number}</p>
                      <p className="truncate text-sm text-[#3D5170]">{[doc.action === "pay" && doc.dueAt ? `Due ${shortDate(doc.dueAt)}` : null, doc.label, multi ? doc.customerName : null].filter(Boolean).join(" · ")}</p>
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
                        {md ? (<><span>{md.m}</span><span className="text-[15px]">{md.d}</span></>) : <span className="text-[15px]">•</span>}
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
              <ul>
                {home.history.map((h) => (
                  <li key={h.id} className="flex gap-3 border-t border-[#E6EEF8] py-3 first:border-t-0 first:pt-0">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#EAF3FF] text-[#1F6FEB]"><Check className="h-5 w-5" aria-hidden="true" /></div>
                    <div className="min-w-0">
                      <p className="text-[15px] font-bold">{h.title}</p>
                      <p className="text-sm text-[#3D5170]">{[shortDate(h.date), h.unit, h.jobNumber].filter(Boolean).join(" · ")}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[15px] text-[#3D5170]">Your completed visits will show here.</p>
            )}
          </Card>
        </div>

        <div className="grid content-start gap-4">
          <Card title="Your equipment">
            {home.units.length ? (
              <ul>
                {home.units.map((u) => (
                  <li key={u.id} className="border-t border-[#E6EEF8] first:border-t-0">
                    <Link href={`/my/equipment/${u.id}`} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="text-[15px] font-bold">{u.name}</p>
                        <p className="truncate text-sm text-[#3D5170]">{[u.detail, u.tag ? `Tag ${u.tag}` : null, multi ? u.customerName : null].filter(Boolean).join(" · ")}</p>
                        <p className="text-sm text-[#3D5170]">{u.lastService ? `Last service ${shortDate(u.lastService)}` : "No service on record yet"}</p>
                      </div>
                      <ChevronRight className="h-5 w-5 shrink-0 text-[#1F6FEB]" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[15px] text-[#3D5170]">We&apos;ll add your units here after our first visit.</p>
            )}
          </Card>

          {home.paid.length ? (
            <Card title="Paid">
              <ul>
                {home.paid.map((doc) => (
                  <li key={doc.id} className="border-t border-[#E6EEF8] first:border-t-0">
                    <Link href={`/portal/${doc.token}`} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="text-[15px] font-bold">Invoice {doc.number} · {money(doc.amount)}</p>
                        <p className="text-sm text-[#3D5170]">{[doc.paidAt ? `Paid ${shortDate(doc.paidAt)}` : "Paid", multi ? doc.customerName : null].filter(Boolean).join(" · ")}</p>
                      </div>
                      <ChevronRight className="h-5 w-5 shrink-0 text-[#1F6FEB]" aria-hidden="true" />
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
