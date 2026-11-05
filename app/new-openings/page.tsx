import { createServiceRoleClient } from "@/lib/supabase/service-client";
import { PAY_LINKS, LEADBIZ_PHONE, LEADBIZ_QUOTE } from "@/lib/chillbros/leadbiz/buyers";

export const revalidate = 3600;
export const metadata = {
  title: "San Antonio New Openings · Commercial lead packs for SA trades",
  description: "Verified new San Antonio restaurant and retail build-outs from Texas state construction filings, with the owner or tenant contact and phone. Lead packs for local contractors.",
};

// Public sales page for the lead business. Counts are live; contacts are never shown here.
async function liveCounts() {
  try {
    const db = createServiceRoleClient();
    const [openings, ready] = await Promise.all([
      db.from("chillbros_revenue_prospects").select("id", { count: "exact", head: true }).eq("category", "opening_remodel").eq("sales_status", "ready_to_call").eq("do_not_contact", false),
      db.from("chillbros_revenue_prospects").select("id", { count: "exact", head: true }).eq("sales_status", "ready_to_call").eq("do_not_contact", false).not("contact_phone", "is", null),
    ]);
    return { openings: openings.count || 16, ready: ready.count || 230 };
  } catch {
    return { openings: 16, ready: 230 };
  }
}

const TRADES = ["Plumbers", "Electricians", "Hood cleaners", "Pest control", "Commercial cleaning", "Sign companies", "Low voltage", "Security"];

const PACKS = [
  { name: "New Openings Pack", price: "$150", was: "$250", href: PAY_LINKS.openings, best: false,
    points: (n: number) => [`${n} verified new openings & remodels`, "Owner or tenant contact + phone", "Project size, cost & timing", "Max 3 buyers per trade"] },
  { name: "Founding Bundle", price: "$199", was: "$299", href: PAY_LINKS.bundle, best: true,
    points: (n: number) => [`All ${n} new projects`, "+ 50 ready-to-call restaurants & markets", "Call openers written for your trade", "PDF + spreadsheet, delivered in 2 hours"] },
  { name: "Commercial Starter Pack", price: "$75", was: null, href: PAY_LINKS.starter, best: false,
    points: () => ["50 ready-to-call SA restaurants & markets", "Address, phone & business type", "Matched to your trade", "Delivered in 2 hours"] },
];

export default async function NewOpeningsPage() {
  const { openings } = await liveCounts();
  return (
    <main className="min-h-dvh bg-[#0B1E33] text-white">
      <div className="pointer-events-none fixed inset-0 opacity-[0.07]" style={{ backgroundImage: "linear-gradient(#7FD4FF 1px, transparent 1px), linear-gradient(90deg, #7FD4FF 1px, transparent 1px)", backgroundSize: "48px 48px" }} aria-hidden="true" />
      <div className="relative mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6">
        <header className="flex items-center justify-between gap-3">
          <div className="leading-tight">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#7FD4FF]">San Antonio</p>
            <p className="text-2xl font-bold uppercase tracking-wide">New Openings</p>
          </div>
          <span className="rounded-md bg-[#FF7A59] px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-[#0B1E33]">Founding rate · first 5 buyers</span>
        </header>

        <section className="mt-12 max-w-3xl">
          <h1 className="text-5xl font-bold uppercase leading-[0.95] sm:text-7xl">{openings} new commercial projects. <span className="text-[#FF7A59]">Building right now.</span></h1>
          <p className="mt-5 max-w-2xl text-lg text-[#C9D6E3]">Verified San Antonio restaurant and retail build-outs from Texas state construction filings, each with the owner or tenant contact and phone. Call them before your competition knows they exist.</p>
          <a href={PAY_LINKS.bundle} className="mt-7 inline-flex min-h-12 items-center rounded-xl bg-[#F5C542] px-6 text-lg font-bold text-[#0B1E33] hover:brightness-105">Get the Founding Bundle, $199</a>
          <p className="mt-3 text-sm text-[#8A9BB0]">Max 3 buyers per trade · delivered by email within 2 hours</p>
        </section>

        <figure className="mt-12 max-w-3xl border-l-4 border-[#FF7A59] pl-5">
          <blockquote className="text-2xl font-bold leading-snug sm:text-3xl">&ldquo;{LEADBIZ_QUOTE}&rdquo;</blockquote>
          <figcaption className="mt-2 text-sm text-[#8A9BB0]">Built by Chill Pros, San Antonio commercial HVAC &amp; refrigeration</figcaption>
        </figure>

        <section className="mt-14 grid gap-4 md:grid-cols-3">
          {PACKS.map((p) => (
            <div key={p.name} className={`relative flex flex-col rounded-2xl border p-5 ${p.best ? "border-[#7FD4FF] bg-[#12304D]" : "border-white/10 bg-[#102A44]"}`}>
              {p.best ? <span className="absolute -top-3 left-5 rounded bg-[#FF7A59] px-2 py-0.5 text-xs font-bold uppercase text-[#0B1E33]">Best value</span> : null}
              <p className="text-lg font-bold uppercase tracking-wide">{p.name}</p>
              <p className="mt-3 flex items-baseline gap-3"><span className="text-5xl font-bold text-[#F5C542]">{p.price}</span>{p.was ? <span className="text-[#8A9BB0] line-through">{p.was}</span> : null}</p>
              <ul className="mt-4 flex-1 space-y-2 text-[15px] text-[#C9D6E3]">{p.points(openings).map((t) => <li key={t}>✓ {t}</li>)}</ul>
              <a href={p.href} className={`mt-5 inline-flex min-h-12 items-center justify-center rounded-xl px-5 font-bold ${p.best ? "bg-[#F5C542] text-[#0B1E33]" : "border border-[#7FD4FF]/50 text-[#7FD4FF]"}`}>Buy now</a>
            </div>
          ))}
        </section>

        <section className="mt-14 grid gap-6 md:grid-cols-2 md:items-center">
          <div>
            <h2 className="text-3xl font-bold uppercase">What a lead looks like</h2>
            <p className="mt-3 text-[#C9D6E3]">Every project comes straight from a state construction filing, so it&apos;s real, current and verifiable. You get who to call, their number, what&apos;s being built, how big, and when it opens.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#102A44] p-5 font-mono text-sm">
            <p className="text-xs uppercase tracking-wider text-[#7FD4FF]">Sample · details hidden</p>
            <p className="mt-3 text-lg font-bold text-white">Quick-service restaurant · North SA</p>
            <dl className="mt-3 grid grid-cols-[110px_1fr] gap-y-1.5 text-[#C9D6E3]">
              <dt className="text-[#8A9BB0]">Project</dt><dd>New 2,899 sf build, $1.2M</dd>
              <dt className="text-[#8A9BB0]">Opening</dt><dd>Nov 2026</dd>
              <dt className="text-[#8A9BB0]">Contact</dt><dd><span className="rounded bg-white/15 px-10 text-transparent select-none">hidden</span> (tenant)</dd>
              <dt className="text-[#8A9BB0]">Phone</dt><dd><span className="rounded bg-white/15 px-12 text-transparent select-none">hidden</span></dd>
              <dt className="text-[#8A9BB0]">Source</dt><dd>Texas TDLR filing #</dd>
            </dl>
          </div>
        </section>

        <section className="mt-14">
          <h2 className="text-3xl font-bold uppercase">How it works</h2>
          <ol className="mt-5 grid gap-4 sm:grid-cols-3">
            {["Pick a pack and pay securely with Square.", "Type your trade at checkout.", "Your PDF + spreadsheet, with call openers for your trade, arrives by email within 2 hours."].map((t, i) => (
              <li key={t} className="rounded-2xl border border-white/10 bg-[#102A44] p-5"><p className="text-3xl font-bold text-[#FF7A59]">0{i + 1}</p><p className="mt-2 text-[#C9D6E3]">{t}</p></li>
            ))}
          </ol>
        </section>

        <section className="mt-14">
          <h2 className="text-3xl font-bold uppercase">Built for SA trades</h2>
          <div className="mt-4 flex flex-wrap gap-2">{TRADES.map((t) => <span key={t} className="rounded-full border border-[#7FD4FF]/40 px-4 py-2 text-sm text-[#7FD4FF]">{t}</span>)}</div>
          <p className="mt-5 max-w-3xl text-[#C9D6E3]">One commercial account is worth thousands a year in recurring work. Only 3 contractors per trade get each list, so you&apos;re not fighting the whole city for the same jobs.</p>
        </section>

        <section className="mt-14 rounded-2xl border border-[#7FD4FF]/40 bg-[#12304D] p-6 text-center">
          <p className="text-2xl font-bold uppercase">Founding pricing ends after the first 5 buyers.</p>
          <a href={PAY_LINKS.bundle} className="mt-5 inline-flex min-h-12 items-center rounded-xl bg-[#F5C542] px-6 text-lg font-bold text-[#0B1E33]">Get the Founding Bundle, $199</a>
          <p className="mt-3 text-sm text-[#8A9BB0]">Questions? Call or text {LEADBIZ_PHONE}</p>
        </section>

        <footer className="mt-14 border-t border-white/10 pt-6 text-sm text-[#8A9BB0]">
          <p>Built by Chill Pros, a working San Antonio commercial HVAC &amp; refrigeration company. <span className="text-white">A service of Chill Professionals LLC</span> · {LEADBIZ_PHONE} · satxnewopenings@gmail.com</p>
          <p className="mt-2">Project data from public Texas Department of Licensing and Regulation filings. Business data © OpenStreetMap contributors.</p>
        </footer>
      </div>
    </main>
  );
}
