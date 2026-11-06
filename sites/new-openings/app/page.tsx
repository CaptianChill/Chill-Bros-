import { BRAND, PACKS, TRADES } from "@/lib/brand";
import { publicStats } from "@/lib/db";

export const revalidate = 3600;

export default async function SalesPage() {
  const { openings } = await publicStats();
  const growth = PACKS.find((p) => p.key === "growth")!;
  return (
    <main className="relative">
      <div className="pointer-events-none fixed inset-0 opacity-[0.07]" style={{ backgroundImage: "linear-gradient(#7FD4FF 1px, transparent 1px), linear-gradient(90deg, #7FD4FF 1px, transparent 1px)", backgroundSize: "48px 48px" }} aria-hidden="true" />
      <div className="relative mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6">
        <header className="flex items-center justify-between gap-3">
          <div className="leading-tight">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#7FD4FF]">{BRAND.eyebrow}</p>
            <p className="text-2xl font-bold uppercase tracking-wide">{BRAND.wordmark}</p>
          </div>
          <span className="rounded-md bg-[#FF7A59] px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-[#0B1E33]">Max 3 buyers per trade per project</span>
        </header>

        <section className="mt-12 max-w-3xl">
          <h1 className="text-5xl font-bold uppercase leading-[0.95] sm:text-7xl">{openings} new commercial projects. <span className="text-[#FF7A59]">Building right now.</span></h1>
          <p className="mt-5 max-w-2xl text-lg text-[#C9D6E3]">Verified San Antonio restaurant, retail and auto build-outs from Texas state construction filings, each with the owner or tenant contact and phone. {BRAND.tagline}</p>
          <a href={growth.href} className="mt-7 inline-flex min-h-12 items-center rounded-xl bg-[#F5C542] px-6 text-lg font-bold text-[#0B1E33] hover:brightness-105">Packs from $89 · plans from $99/mo</a>
          <p className="mt-3 text-sm text-[#8A9BB0]">Fixed project counts · private link by email within 2 hours</p>
        </section>

        <figure className="mt-12 max-w-3xl border-l-4 border-[#FF7A59] pl-5">
          <blockquote className="text-2xl font-bold leading-snug sm:text-3xl">&ldquo;{BRAND.quote}&rdquo;</blockquote>
        </figure>

        <section className="mt-14 grid gap-x-4 gap-y-8 md:grid-cols-2 lg:grid-cols-3">
          {PACKS.map((p) => (
            <div key={p.key} className={`relative flex flex-col rounded-2xl border p-5 ${p.best ? "border-[#7FD4FF] bg-[#12304D]" : "border-white/10 bg-[#102A44]"}`}>
              {p.best || p.badge ? <span className="absolute -top-3 left-5 rounded bg-[#FF7A59] px-2 py-0.5 text-xs font-bold uppercase text-[#0B1E33]">{p.best ? "Best value" : p.badge}</span> : null}
              <p className="text-lg font-bold uppercase tracking-wide">{p.name}</p>
              <p className="mt-3 flex items-baseline gap-3"><span className="text-5xl font-bold text-[#F5C542]">{p.price}</span>{p.period ? <span className="text-lg font-semibold">{p.period}</span> : null}{p.was ? <span className="text-[#8A9BB0] line-through">{p.was}</span> : null}</p>
              <ul className="mt-4 flex-1 space-y-2 text-[15px] text-[#C9D6E3]">{p.points().map((t) => <li key={t}>✓ {t}</li>)}</ul>
              <a href={p.href} className={`mt-5 inline-flex min-h-12 items-center justify-center rounded-xl px-5 font-bold ${p.best ? "bg-[#F5C542] text-[#0B1E33]" : "border border-[#7FD4FF]/50 text-[#7FD4FF]"}`}>Buy now</a>
            </div>
          ))}
        </section>

        <section className="mt-14 grid gap-6 md:grid-cols-2 md:items-center">
          <div>
            <h2 className="text-3xl font-bold uppercase">What a lead looks like</h2>
            <p className="mt-3 text-[#C9D6E3]">Every project comes from a state construction filing, so it&apos;s real, current and verifiable. You get who to call, their number, what&apos;s being built, how big, and when it opens.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#102A44] p-5 font-mono text-sm">
            <p className="text-xs uppercase tracking-wider text-[#7FD4FF]">Sample · details hidden</p>
            <p className="mt-3 text-lg font-bold">Quick-service restaurant · North SA</p>
            <dl className="mt-3 grid grid-cols-[110px_1fr] gap-y-1.5 text-[#C9D6E3]">
              <dt className="text-[#8A9BB0]">Project</dt><dd>New 2,899 sf build, $1.2M</dd>
              <dt className="text-[#8A9BB0]">Opening</dt><dd>Nov 2026</dd>
              <dt className="text-[#8A9BB0]">Contact</dt><dd><span className="select-none rounded bg-white/15 px-10 text-transparent">hidden</span> (tenant)</dd>
              <dt className="text-[#8A9BB0]">Phone</dt><dd><span className="select-none rounded bg-white/15 px-12 text-transparent">hidden</span></dd>
              <dt className="text-[#8A9BB0]">Source</dt><dd>Texas TDLR filing #</dd>
            </dl>
          </div>
        </section>

        <section className="mt-14">
          <h2 className="text-3xl font-bold uppercase">How it works</h2>
          <ol className="mt-5 grid gap-4 sm:grid-cols-3">
            {["Pick your trade and a pack or monthly plan.", "Pay securely with Square once we confirm your trade has open projects.", "A private link to your projects, with call openers and a spreadsheet, arrives by email within 2 hours."].map((t, i) => (
              <li key={t} className="rounded-2xl border border-white/10 bg-[#102A44] p-5"><p className="text-3xl font-bold text-[#FF7A59]">0{i + 1}</p><p className="mt-2 text-[#C9D6E3]">{t}</p></li>
            ))}
          </ol>
        </section>

        <section className="mt-14">
          <h2 className="text-3xl font-bold uppercase">Built for SA trades</h2>
          <div className="mt-4 flex flex-wrap gap-2">{TRADES.map((t) => <span key={t} className="rounded-full border border-[#7FD4FF]/40 px-4 py-2 text-sm text-[#7FD4FF]">{t}</span>)}</div>
          <p className="mt-5 max-w-3xl text-[#C9D6E3]">One commercial account is worth thousands a year in recurring work. No more than 3 contractors in your trade ever get the same project, so you&apos;re not fighting the whole city for the same jobs.</p>
          <p className="mt-3 max-w-3xl font-semibold text-white"><span className="mr-2 rounded bg-[#FF7A59] px-2 py-0.5 text-xs font-bold uppercase text-[#0B1E33]">New</span>Now including auto: 13 new car washes, oil change, collision and dealer service shops. Included for every trade except hood cleaning and kitchen equipment.</p>
        </section>

        <section className="mt-14 rounded-2xl border border-[#7FD4FF]/40 bg-[#12304D] p-6 text-center">
          <p className="text-2xl font-bold uppercase">New projects every month, never repeats.</p>
          <a href={growth.href.replace("growth", "local")} className="mt-5 inline-flex min-h-12 items-center rounded-xl bg-[#F5C542] px-6 text-lg font-bold text-[#0B1E33]">Start the Local Plan, $99/mo</a>
          <p className="mt-3 text-sm text-[#8A9BB0]">Questions? Call or text {BRAND.phone}</p>
        </section>

        <footer className="mt-14 border-t border-white/10 pt-6 text-sm text-[#8A9BB0]">
          <p>&ldquo;{BRAND.quote}&rdquo; <span className="text-white">{BRAND.legal}</span> · {BRAND.phone} · {BRAND.email}</p>
          <p className="mt-2">{BRAND.attribution}</p>
        </footer>
      </div>
    </main>
  );
}
