import { BRAND } from "@/lib/brand";

export default function SalesPage() {
  return (
    <main className="relative">
      <div className="site-frame pb-16 pt-6">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/15 pb-5">
          <div className="leading-tight">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#7FD4FF]">{BRAND.eyebrow}</p>
            <p className="text-2xl font-bold uppercase tracking-wide">{BRAND.wordmark}</p>
          </div>
          <span className="text-sm text-[#C9D6E3]">Availability by trade and area</span>
        </header>

        <section className="grid items-center gap-10 py-12 lg:grid-cols-[1.25fr_1fr] lg:py-20">
          <div>
          <p className="text-sm font-bold uppercase tracking-widest text-[#7FD4FF]">San Antonio · Restaurant and retail openings</p>
          <h1 className="mt-3 max-w-[15ch] text-[clamp(2.5rem,5vw,5rem)] font-semibold leading-[1.05] tracking-tight">Find commercial projects worth calling about</h1>
          <p className="mt-5 max-w-2xl text-lg text-[#C9D6E3]">Start with five commercial cleaning project cards for $49. See the project stage, likely service fit and what to ask on the first call.</p>
          <a href="/project-sample.html#cleaning-example" className="mt-7 inline-flex min-h-12 items-center rounded-xl bg-[#F5C542] px-6 text-lg font-bold text-[#0B1E33]">See a real redacted example</a>
          <p className="mt-3 text-sm text-[#C9D6E3]">Request availability before payment. We confirm the match and delivery timing before sending a Square invoice.</p>
          </div>
          <aside className="min-w-0 border-y border-white/20 bg-[#102A44] p-6 sm:p-8" aria-label="Sample project summary">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#7FD4FF]">From the project file</p>
            <h2 className="mt-3 text-2xl font-semibold">Restaurant buildout</h2>
            <dl className="mt-5 divide-y divide-white/15 text-sm">
              <div className="flex flex-wrap justify-between gap-2 py-3"><dt>Area</dt><dd className="text-[#C9D6E3]">Southeast San Antonio</dd></div>
              <div className="flex flex-wrap justify-between gap-2 py-3"><dt>Filed completion</dt><dd className="text-[#C9D6E3]">Spring 2027</dd></div>
              <div className="flex flex-wrap justify-between gap-2 py-3"><dt>Possible scope</dt><dd className="text-[#C9D6E3]">Turnover cleaning</dd></div>
            </dl>
            <p className="mt-4 text-sm text-[#C9D6E3]">Cleaning fit is inferred. Hiring status is unconfirmed.</p>
          </aside>
        </section>

        <section className="border-t border-white/15 pt-8" aria-labelledby="packs">
          <h2 id="packs" className="text-3xl font-bold">Launch packs</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {[
              ["Launch Starter", "5 cards", "$49", "A short list for testing one trade and service area."],
              ["Trade Pack", "9 cards", "$89", "A larger list for a contractor doing regular outreach."],
              ["Growth Pack", "13 cards", "$119", "More projects for a crew with time to follow up."],
            ].map(([name, count, price, description]) => (
              <div key={name} className="rounded-2xl border border-white/10 bg-[#102A44] p-5">
                <h3 className="text-lg font-bold">{name}</h3>
                <p className="mt-2 text-3xl font-bold text-[#F5C542]">{price}</p>
                <p className="mt-2 text-[#C9D6E3]">{count} · {description}</p>
              </div>
            ))}
          </div>
          <a href="/project-sample.html#packs" className="mt-5 inline-flex min-h-12 items-center rounded-xl border border-[#7FD4FF]/50 px-5 font-bold text-[#7FD4FF]">Check pack availability</a>
        </section>

        <section className="mt-14">
          <h2 className="text-3xl font-bold">How it works</h2>
          <ol className="mt-5 grid gap-4 sm:grid-cols-3">
            {["Tell us your trade, service area and pack size.", "We confirm availability and delivery timing before sending a Square invoice.", "After payment, we send your project cards privately."].map((step, index) => (
              <li key={step} className="rounded-2xl border border-white/10 bg-[#102A44] p-5"><p className="text-3xl font-bold text-[#FF7A59]">0{index + 1}</p><p className="mt-2 text-[#C9D6E3]">{step}</p></li>
            ))}
          </ol>
        </section>

        <footer className="mt-14 border-t border-white/10 pt-6 text-sm text-[#8A9BB0]">
          <p>&ldquo;{BRAND.quote}&rdquo; <span className="text-white">{BRAND.legal}</span> · {BRAND.phone} · {BRAND.email}</p>
          <p className="mt-2">{BRAND.attribution}</p>
        </footer>
      </div>
    </main>
  );
}
