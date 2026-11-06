"use client";

import { useEffect, useState } from "react";

export type FlyerTrade = { slug: string; label: string; need: string; checkout: string; opener: string; plural: string; hook: string; projects: number; mix: string };
export type FlyerPack = { key: string; name: string; price: string; was: string | null; href: string; best?: boolean; points: string[] };

// The interactive part of /new-openings: trade chooser (deep link ?trade=<slug>) and pack picker.
// Everything it shows comes in as props from the static page; it fetches nothing.
export function NewOpeningsFlyer({ trades, packs, phone, email }: { trades: FlyerTrade[]; packs: FlyerPack[]; phone: string; email: string }) {
  const [slug, setSlug] = useState<string | null>(null);
  const [packKey, setPackKey] = useState(packs.find((p) => p.best)?.key ?? packs[0].key);

  // Deep link: /new-openings?trade=plumbers. Read after mount so the page itself stays static.
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("trade");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync from the URL on mount
    if (wanted && trades.some((t) => t.slug === wanted)) setSlug(wanted);
  }, [trades]);

  const pick = (next: string) => {
    setSlug(next);
    try { window.history.replaceState(null, "", `?trade=${next}`); } catch { /* deep link is a convenience */ }
  };

  const trade = trades.find((t) => t.slug === slug) ?? null;
  const max = Math.max(...trades.map((t) => t.projects));
  const n = trade?.projects ?? max;
  const pack = packs.find((p) => p.key === packKey) ?? packs[0];
  const fill = (s: string) => s.replace("{n}", String(n));
  const digits = phone.replace(/\D/g, "");

  return (
    <>
      <section className="mt-8 max-w-3xl">
        <div className="flex flex-wrap gap-2">
          <span className="rounded-md bg-[#FF7A59] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-[#0B1E33]">Founding rate: first 5 buyers</span>
          <span className="rounded-md border border-[#F5C542]/60 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-[#F5C542]">Max 3 buyers per trade</span>
        </div>
        <h1 key={trade?.slug ?? "all"} className="mt-5 text-[2.6rem] font-bold uppercase leading-[0.95] sm:text-7xl">
          {trade ? <>{n} new SA projects need {trade.need}.</> : <>{n} new commercial projects.</>}{" "}
          <span className="text-[#FF7A59]">{trade ? "Call them first." : "Building right now."}</span>
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-[#C9D6E3]">
          {trade
            ? <>Every one needs <span className="font-semibold text-white">{trade.hook}</span>. Verified San Antonio build-outs from Texas state construction filings, each with the owner or tenant contact and phone.</>
            : <>Verified San Antonio restaurant, retail and auto build-outs from Texas state construction filings, each with the owner or tenant contact and phone. Call them before your competition knows they exist.</>}
        </p>
      </section>

      <section className="mt-8" aria-labelledby="pick-trade">
        <h2 id="pick-trade" className="text-sm font-bold uppercase tracking-[0.18em] text-[#7FD4FF]">Step 1 · Pick your trade</h2>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          {trades.map((t) => {
            const on = t.slug === slug;
            return (
              <button key={t.slug} type="button" aria-pressed={on} onClick={() => pick(t.slug)}
                className={`min-h-12 rounded-xl border px-3 py-2 text-left text-[15px] font-semibold leading-tight transition active:scale-[0.97] sm:rounded-full sm:px-4 ${on ? "border-[#F5C542] bg-[#F5C542] text-[#0B1E33] shadow-[0_0_0_3px_rgba(245,197,66,0.25)]" : "border-[#7FD4FF]/40 bg-[#102A44] text-[#7FD4FF] hover:border-[#7FD4FF]"}`}>
                {t.label}
              </button>
            );
          })}
        </div>
      </section>

      {trade ? (
        <section className="mt-6 grid gap-4 md:grid-cols-2" aria-live="polite">
          <div className="rounded-2xl border border-white/10 bg-[#102A44] p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-[#7FD4FF]">Your list · {trade.label}</p>
            <p className="mt-2 text-5xl font-bold text-[#F5C542]">{trade.projects}<span className="ml-2 text-lg font-semibold uppercase text-white">projects</span></p>
            <p className="mt-2 text-[15px] text-[#C9D6E3]">{trade.mix}</p>
          </div>
          <div className="rounded-2xl border border-[#FF7A59]/50 bg-[#12304D] p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-[#FF7A59]">Sample call opener</p>
            <p className="mt-2 text-[16px] leading-relaxed text-white">&ldquo;{trade.opener}&rdquo;</p>
            <p className="mt-2 text-xs text-[#8A9BB0]">The Founding Bundle includes openers like this, written for {trade.plural}.</p>
          </div>
        </section>
      ) : (
        <p className="mt-4 text-sm text-[#8A9BB0]">Tap your trade to see your project count and a sample call opener.</p>
      )}

      <section className="mt-10" aria-labelledby="pick-pack">
        <h2 id="pick-pack" className="text-sm font-bold uppercase tracking-[0.18em] text-[#7FD4FF]">Step 2 · Pick your pack</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {packs.map((p) => {
            const on = p.key === pack.key;
            return (
              <div key={p.key} onClick={() => setPackKey(p.key)}
                className={`relative flex cursor-pointer flex-col rounded-2xl border p-5 transition ${on ? "border-[#F5C542] bg-[#12304D] shadow-[0_0_0_3px_rgba(245,197,66,0.2)]" : "border-white/10 bg-[#102A44]"}`}>
                {p.best ? <span className="absolute -top-3 left-5 rounded bg-[#FF7A59] px-2 py-0.5 text-xs font-bold uppercase text-[#0B1E33]">Best value · founding rate</span> : null}
                <label className="flex items-center gap-3 text-lg font-bold uppercase tracking-wide">
                  <input type="radio" name="pack" checked={on} onChange={() => setPackKey(p.key)} className="h-5 w-5 accent-[#F5C542]" />
                  {p.name}
                </label>
                <p className="mt-3 flex items-baseline gap-3"><span className="text-5xl font-bold text-[#F5C542]">{p.price}</span>{p.was ? <span className="text-[#8A9BB0] line-through">{p.was}</span> : null}</p>
                <ul className="mt-4 flex-1 space-y-2 text-[15px] text-[#C9D6E3]">{p.points.map((t) => <li key={t}>✓ {fill(t)}</li>)}<li>✓ Delivered by email within 2 hours</li></ul>
                <a href={p.href} rel="noopener" className={`mt-5 inline-flex min-h-12 items-center justify-center rounded-xl px-5 text-lg font-bold ${p.best || on ? "bg-[#F5C542] text-[#0B1E33]" : "border border-[#7FD4FF]/50 text-[#7FD4FF]"}`}>Buy {p.name.replace(/ Pack$/, "")} · {p.price}</a>
              </div>
            );
          })}
        </div>
        <div className="mt-5 rounded-2xl border border-dashed border-[#F5C542]/60 bg-[#0F2740] p-4 text-[15px] text-[#C9D6E3]">
          <p><span className="font-bold text-[#F5C542]">At checkout, type your trade</span>{trade ? <>: <span className="rounded bg-white/10 px-2 py-0.5 font-mono font-bold text-white">{trade.checkout}</span></> : null} so we send the right list.</p>
          <p className="mt-1 text-sm text-[#8A9BB0]">Secure Square checkout: card, Apple Pay, Google Pay or Cash App Pay. Max 3 buyers per trade.</p>
        </div>
      </section>

      <section className="mt-10 grid gap-6 md:grid-cols-2 md:items-center">
        <div>
          <h2 className="text-2xl font-bold uppercase sm:text-3xl">What a lead looks like</h2>
          <p className="mt-3 text-[#C9D6E3]">Every project comes straight from a state construction filing, so it&apos;s real, current and verifiable. You get who to call, their number, what&apos;s being built, how big, and when it opens.</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#102A44] p-5 font-mono text-sm">
          <p className="text-xs uppercase tracking-wider text-[#7FD4FF]">Sample · details hidden</p>
          <p className="mt-3 text-lg font-bold text-white">Quick-service restaurant · North SA</p>
          <dl className="mt-3 grid grid-cols-[96px_1fr] gap-y-1.5 text-[#C9D6E3]">
            <dt className="text-[#8A9BB0]">Project</dt><dd>New 2,899 sf build, $1.2M</dd>
            <dt className="text-[#8A9BB0]">Opening</dt><dd>Nov 2026</dd>
            <dt className="text-[#8A9BB0]">Needs</dt><dd>{trade ? trade.hook : "your trade"}</dd>
            <dt className="text-[#8A9BB0]">Contact</dt><dd><span className="select-none rounded bg-white/15 px-10 text-transparent">hidden</span> (tenant)</dd>
            <dt className="text-[#8A9BB0]">Phone</dt><dd><span className="select-none rounded bg-white/15 px-12 text-transparent">hidden</span></dd>
            <dt className="text-[#8A9BB0]">Source</dt><dd>Texas TDLR filing #</dd>
          </dl>
        </div>
      </section>

      <section className="mt-10 rounded-2xl border border-white/10 bg-[#102A44] p-5 text-[15px] text-[#C9D6E3]">
        <p className="font-bold text-white">Questions before you buy?</p>
        <p className="mt-1">Call or text <a href={`tel:${digits}`} className="font-bold text-[#7FD4FF]">{phone}</a> · <a href={`mailto:${email}`} className="font-bold text-[#7FD4FF]">{email}</a></p>
        <div className="mt-3 flex gap-2">
          <a href={`tel:${digits}`} className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-[#7FD4FF]/50 font-bold text-[#7FD4FF] sm:flex-none sm:px-6">Call</a>
          <a href={`sms:${digits}`} className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-[#7FD4FF]/50 font-bold text-[#7FD4FF] sm:flex-none sm:px-6">Text</a>
        </div>
      </section>

      {/* Sticky buy bar on phones: always one tap from checkout for the selected pack. */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-[#0B1E33]/95 px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 backdrop-blur sm:hidden">
        <a href={pack.href} rel="noopener" className="flex min-h-12 items-center justify-center rounded-xl bg-[#F5C542] px-4 text-center text-[17px] font-bold text-[#0B1E33]">
          Buy {pack.name} · {pack.price}
        </a>
        <p className="mt-1.5 text-center text-[11px] text-[#8A9BB0]">{trade ? <>Type &ldquo;{trade.checkout}&rdquo; at checkout</> : "Type your trade at checkout"} · max 3 per trade</p>
      </div>
    </>
  );
}
