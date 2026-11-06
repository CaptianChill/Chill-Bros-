import type { Metadata } from "next";

import { LEADBIZ_PHONE, LEADBIZ_QUOTE, TRADE_LABEL, packProjects, FOOD_OPENINGS, AUTO_OPENINGS } from "@/lib/chillbros/leadbiz/buyers";
import { PACKS, PLANS, perProject, termTotal, type Product } from "@/lib/chillbros/leadbiz/catalog";
import type { Trade } from "@/lib/chillbros/trade-fit";

import { NewOpeningsFlyer, type FlyerPack, type FlyerTrade } from "./flyer";

// App name/icon overrides live in ./layout.tsx (shared with /new-openings/terms).
export const metadata: Metadata = {
  title: "San Antonio New Openings · Commercial lead packs for SA trades",
  description: "Verified new San Antonio restaurant, retail and auto build-outs from Texas state construction filings, with the owner or tenant contact and phone. Lead packs for local contractors.",
};

const EMAIL = "satxnewopenings@gmail.com";

// Public sales flyer for the lead business. Fully static: no database reads, and it
// never shows lead contact details or any lead-pack download link.
// slug -> trade; slugs are the ?trade= deep links used in texts and emails.
const TRADES: { slug: string; trade: Trade; label: string; need: string; checkout: string; opener: string }[] = [
  { slug: "plumbers", trade: "plumbing", label: "Plumbers", need: "a plumber", checkout: "Plumbing",
    opener: "Hi, this is [your name] with [your company]. Congrats on the new location. We do commercial rough-in, grease traps and backflow testing for new openings in San Antonio. Who's handling plumbing before your inspection?" },
  { slug: "electricians", trade: "electrical", label: "Electricians", need: "an electrician", checkout: "Electrical",
    opener: "Hi, this is [your name] with [your company]. Saw you're building out the new space. We wire panels, kitchen circuits and lighting for new commercial openings. Is your electrical locked in before inspection?" },
  { slug: "hood-cleaners", trade: "hood_cleaning", label: "Hood cleaners", need: "a hood cleaner", checkout: "Hood cleaning",
    opener: "Hi, this is [your name] with [your company]. Before your fire inspection the hood system has to be cleaned and certified. We do that for new kitchens all over SA. Want me to get you on the schedule before opening?" },
  { slug: "pest-control", trade: "pest_control", label: "Pest control", need: "pest control", checkout: "Pest control",
    opener: "Hi, this is [your name] with [your company]. The health inspector will want a pest program in place before you open. We set those up for new restaurants and stores. Who's handling that for you?" },
  { slug: "commercial-cleaning", trade: "commercial_cleaning", label: "Commercial cleaning", need: "a cleaning crew", checkout: "Commercial cleaning",
    opener: "Hi, this is [your name] with [your company]. When construction wraps you'll need a post-construction clean, then a nightly crew. We do both for new openings in SA. Can I send you a quote?" },
  { slug: "signs", trade: "signs", label: "Sign companies", need: "signs", checkout: "Signs",
    opener: "Hi, this is [your name] with [your company]. Congrats on the new build. We make and permit storefront and pylon signs for new San Antonio openings. Is your signage handled for opening day?" },
  { slug: "low-voltage", trade: "low_voltage", label: "Low voltage", need: "low voltage", checkout: "Low voltage",
    opener: "Hi, this is [your name] with [your company]. Before the walls close you'll want POS, network, music and camera cabling run. We do that for new openings in SA. Who's doing your low voltage?" },
  { slug: "security", trade: "security", label: "Security", need: "security", checkout: "Security",
    opener: "Hi, this is [your name] with [your company]. Before you stock the place you'll want cameras, an alarm and access control live. We install those for new San Antonio businesses. Have you picked a security company yet?" },
  { slug: "hvac-refrigeration", trade: "hvac_refrigeration", label: "HVAC & refrigeration", need: "HVAC & refrigeration", checkout: "HVAC & refrigeration",
    opener: "Hi, this is [your name] with [your company]. New openings need rooftop units, walk-in coolers and ice machines installed and on a service plan. We do that across SA. Who's handling your HVAC and refrigeration?" },
  { slug: "kitchen-equipment", trade: "kitchen_equipment", label: "Hot side / kitchen equipment", need: "kitchen equipment", checkout: "Kitchen equipment",
    opener: "Hi, this is [your name] with [your company]. Your fryers, ovens, ranges and dish machine need to be started up and serviced before opening. We do that for new SA kitchens. Who's doing your equipment startup?" },
];

export default function NewOpeningsPage() {
  const trades: FlyerTrade[] = TRADES.map((t) => {
    const projects = packProjects(t.trade);
    return {
      slug: t.slug, label: t.label, need: t.need, checkout: t.checkout, opener: t.opener,
      plural: TRADE_LABEL[t.trade].plural, hook: TRADE_LABEL[t.trade].hook, projects,
      mix: projects > FOOD_OPENINGS
        ? `${FOOD_OPENINGS} restaurant & retail + ${AUTO_OPENINGS} auto (car washes, oil change, collision, dealer service)`
        : `${FOOD_OPENINGS} restaurant & retail projects (auto shops left out: no kitchens to work on)`,
    };
  });
  const card = (p: Product): FlyerPack => ({
    key: p.key, name: p.name, price: `$${p.price}`, was: null, best: p.best, points: p.points,
    perProject: `$${perProject(p).toFixed(2)}`, monthly: p.kind === "subscription", termTotal: `$${termTotal(p).toLocaleString("en-US")}`,
  });
  const packs = PACKS.map(card);
  const plans = PLANS.map(card);

  return (
    <main className="min-h-dvh overflow-x-hidden bg-[#0B1E33] text-white">
      <div className="pointer-events-none fixed inset-0 opacity-[0.07]" style={{ backgroundImage: "linear-gradient(#7FD4FF 1px, transparent 1px), linear-gradient(90deg, #7FD4FF 1px, transparent 1px)", backgroundSize: "48px 48px" }} aria-hidden="true" />
      <div className="relative mx-auto max-w-5xl px-4 pb-32 pt-5 sm:px-6 sm:pb-16">
        <header className="flex items-center justify-between gap-3">
          <div className="leading-tight">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#7FD4FF]">San Antonio</p>
            <p className="text-xl font-bold uppercase tracking-wide sm:text-2xl">New Openings</p>
          </div>
          <a href={`tel:${LEADBIZ_PHONE.replace(/\D/g, "")}`} className="rounded-lg border border-[#7FD4FF]/40 px-3 py-2 text-sm font-bold text-[#7FD4FF]">{LEADBIZ_PHONE}</a>
        </header>

        <NewOpeningsFlyer trades={trades} packs={packs} plans={plans} phone={LEADBIZ_PHONE} email={EMAIL} />

        <figure className="mt-12 max-w-3xl border-l-4 border-[#FF7A59] pl-5">
          <blockquote className="text-2xl font-bold leading-snug sm:text-3xl">&ldquo;{LEADBIZ_QUOTE}&rdquo;</blockquote>
        </figure>

        <section className="mt-12">
          <h2 className="text-2xl font-bold uppercase sm:text-3xl">How it works</h2>
          <ol className="mt-5 grid gap-3 sm:grid-cols-3">
            {["Pick your trade and a pack, then pay securely with Square: card, Apple Pay, Google Pay or Cash App Pay.", "Type your trade at checkout so we send the right list.", "A private link to your projects, with call openers and a spreadsheet download, arrives by email within 2 hours."].map((t, i) => (
              <li key={t} className="rounded-2xl border border-white/10 bg-[#102A44] p-5"><p className="text-3xl font-bold text-[#FF7A59]">0{i + 1}</p><p className="mt-2 text-[#C9D6E3]">{t}</p></li>
            ))}
          </ol>
          <p className="mt-5 max-w-3xl text-[#C9D6E3]">One commercial account is worth thousands a year in recurring work. No more than 3 contractors in your trade ever get the same project, and you never get a project twice, so you&apos;re not fighting the whole city for the same jobs.</p>
        </section>

        <section className="mt-12 rounded-2xl border border-[#7FD4FF]/40 bg-[#12304D] p-6 text-center">
          <p className="text-2xl font-bold uppercase">Want new projects every month?</p>
          <p className="mt-2 text-[#C9D6E3]">The Local and Pro plans send fresh projects for your trade each month, never repeats. 12-month term, billed monthly.</p>
          <p className="mt-3 text-[#C9D6E3]">Questions? <a className="font-bold text-white underline-offset-2 hover:underline" href={`tel:${LEADBIZ_PHONE.replace(/\D/g, "")}`}>Call</a> or <a className="font-bold text-white underline-offset-2 hover:underline" href={`sms:${LEADBIZ_PHONE.replace(/\D/g, "")}`}>text</a> {LEADBIZ_PHONE} · <a className="font-bold text-white underline-offset-2 hover:underline" href={`mailto:${EMAIL}`}>{EMAIL}</a></p>
        </section>

        <footer className="mt-12 border-t border-white/10 pt-6 text-sm text-[#8A9BB0]">
          <p><span className="text-white">San Antonio New Openings</span>, a service of Chill Professionals LLC · {LEADBIZ_PHONE} · {EMAIL}</p>
          <p className="mt-2">Project data from public Texas Department of Licensing and Regulation filings. Business data © OpenStreetMap contributors.</p>
        </footer>
      </div>
    </main>
  );
}
