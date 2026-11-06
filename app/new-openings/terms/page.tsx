import type { Metadata } from "next";
import Link from "next/link";

import { LEADBIZ_PHONE, LEADBIZ_POSTAL, LEADBIZ_TERMS_EFFECTIVE } from "@/lib/chillbros/leadbiz/buyers";

export const metadata: Metadata = {
  title: "Lead Pack Terms · San Antonio New Openings",
  description: "Terms for San Antonio New Openings lead packs: what you're buying, delivery, refunds and your responsibilities.",
};

const EMAIL = "satxnewopenings@gmail.com";

const TERMS: [string, string][] = [
  ["What you're buying", "A lead pack is a digital information product: a fixed number of projects for your trade, delivered by email as a private link with a spreadsheet download. It is not a service, a referral or an appointment."],
  ["Where the leads come from", "Projects and businesses come from public records (Texas TDLR construction filings, City of San Antonio reports and OpenStreetMap) as of the date the pack was prepared. We don't guarantee any lead is accurate, current or still available. Verify details before you quote or schedule work."],
  ["No guarantee of results", "We sell information only. We don't guarantee jobs, contracts, callbacks, responses or revenue."],
  ["You work the leads", "You are solely responsible for contacting leads by phone, text or email, winning and locking in the work, and following every law that applies to you, including the TCPA, Texas telemarketing rules, CAN-SPAM, do-not-call rules and your trade's licensing requirements."],
  ["We're not part of your deals", "We are not a party to any agreement, bid or dispute between you and a lead."],
  ["All sales final", "Sales are final once your link is delivered. If a file is damaged or never arrives, contact us within 7 days and we'll resend or fix it. If we fail to deliver your pack, we'll refund you."],
  ["Your business use only", "Each pack is licensed to the buying company only and is marked with your name and order number. Don't resell, forward, post or share it or your link. We record when your link is opened, and we may turn off access to a pack that has been shared."],
  ["Shared projects", "Each project is sold to no more than 3 buyers in the same trade, so other contractors may contact the same leads. You will never be sold the same project twice."],
  ["Monthly plans: 12-month term", "Local and Pro plans have a 12-month minimum term, billed monthly through Square on the same day each month. You agree to pay all 12 monthly payments. If you cancel or stop payment before the 12 months are up, the remaining monthly payments for the term are still owed and may be charged to your card on file. After 12 months the plan continues month to month until you cancel, and you can cancel anytime from then on with notice before your next billing date. You keep everything already delivered."],
  ["Our promise on plans", "Each month you get at least the number of new projects your plan lists. If fewer qualifying projects are filed in a month, the difference carries to your next delivery. If we come up short two months in a row, you may cancel the rest of your term with no further payments owed."],
  ["Limit of liability", "Our total liability for any claim is limited to the price you paid for the pack. These terms are governed by Texas law, and any dispute will be handled in Bexar County, Texas."],
  ["Agreement", "By completing checkout you agree to these terms."],
];

export default function LeadPackTermsPage() {
  const digits = LEADBIZ_PHONE.replace(/\D/g, "");
  return (
    <main className="min-h-dvh overflow-x-hidden bg-[#0B1E33] text-white">
      <div className="pointer-events-none fixed inset-0 opacity-[0.07]" style={{ backgroundImage: "linear-gradient(#7FD4FF 1px, transparent 1px), linear-gradient(90deg, #7FD4FF 1px, transparent 1px)", backgroundSize: "48px 48px" }} aria-hidden="true" />
      <div className="relative mx-auto max-w-3xl px-4 pb-16 pt-5 sm:px-6">
        <header className="flex items-center justify-between gap-3">
          <Link href="/new-openings" className="leading-tight">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#7FD4FF]">San Antonio</p>
            <p className="text-xl font-bold uppercase tracking-wide sm:text-2xl">New Openings</p>
          </Link>
          <a href={`tel:${digits}`} className="rounded-lg border border-[#7FD4FF]/40 px-3 py-2 text-sm font-bold text-[#7FD4FF]">{LEADBIZ_PHONE}</a>
        </header>

        <h1 className="mt-8 text-4xl font-bold uppercase leading-none sm:text-5xl">Lead Pack <span className="text-[#FF7A59]">Terms</span></h1>
        <p className="mt-3 text-sm text-[#8A9BB0]">Effective {LEADBIZ_TERMS_EFFECTIVE}</p>
        <p className="mt-4 text-[#C9D6E3]">Plain English, so there are no surprises. Please read before you buy.</p>

        <ol className="mt-6 space-y-3">
          {TERMS.map(([title, body], i) => (
            <li key={title} className="rounded-2xl border border-white/10 bg-[#102A44] p-5">
              <p className="flex items-baseline gap-3 font-bold uppercase tracking-wide"><span className="text-[#F5C542]">{String(i + 1).padStart(2, "0")}</span>{title}</p>
              <p className="mt-2 text-[15px] leading-relaxed text-[#C9D6E3]">{body}</p>
            </li>
          ))}
        </ol>

        <section className="mt-6 rounded-2xl border border-[#7FD4FF]/40 bg-[#12304D] p-5 text-[15px] text-[#C9D6E3]">
          <p className="font-bold text-white">Questions or delivery problems</p>
          <p className="mt-1"><a href={`mailto:${EMAIL}`} className="font-bold text-[#7FD4FF]">{EMAIL}</a> · Call or text <a href={`tel:${digits}`} className="font-bold text-[#7FD4FF]">{LEADBIZ_PHONE}</a></p>
          <p className="mt-3 text-sm text-[#8A9BB0]">Seller: {LEADBIZ_POSTAL}</p>
        </section>

        <Link href="/new-openings" className="mt-6 inline-flex min-h-12 items-center rounded-xl bg-[#F5C542] px-6 font-bold text-[#0B1E33]">Back to the packs</Link>
      </div>
    </main>
  );
}
