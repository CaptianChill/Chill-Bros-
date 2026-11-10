import { BRAND } from "@/lib/brand";

export default function SalesPage() {
  return (
    <main className="relative">
      <div className="pointer-events-none fixed inset-0 opacity-[0.07]" style={{ backgroundImage: "linear-gradient(#7FD4FF 1px, transparent 1px), linear-gradient(90deg, #7FD4FF 1px, transparent 1px)", backgroundSize: "48px 48px" }} aria-hidden="true" />
      <div className="relative mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6">
        <header className="flex items-center justify-between gap-3">
          <div className="leading-tight">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#7FD4FF]">{BRAND.eyebrow}</p>
            <p className="text-2xl font-bold uppercase tracking-wide">{BRAND.wordmark}</p>
          </div>
          <span className="rounded-md bg-[#FF7A59] px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-[#0B1E33]">Availability by trade and area</span>
        </header>

        <section className="mt-12 max-w-3xl">
          <p className="text-sm font-bold uppercase tracking-widest text-[#7FD4FF]">San Antonio · Restaurant and retail openings</p>
          <h1 className="mt-3 text-5xl font-bold leading-tight sm:text-7xl">Find commercial projects worth calling about</h1>
          <p className="mt-5 max-w-2xl text-lg text-[#C9D6E3]">Start with five commercial cleaning project cards for $49. See the project stage, likely service fit and what to ask on the first call.</p>
          <a href="/project-sample.html#cleaning-example" className="mt-7 inline-flex min-h-12 items-center rounded-xl bg-[#F5C542] px-6 text-lg font-bold text-[#0B1E33]">See a real redacted example</a>
          <p className="mt-3 text-sm text-[#C9D6E3]">Request availability before payment. We confirm the match and delivery timing before sending a Square invoice.</p>
        </section>

        <section className="mt-14" aria-labelledby="packs">
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
