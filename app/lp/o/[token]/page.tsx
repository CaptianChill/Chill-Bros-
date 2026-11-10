import { LEADBIZ_PHONE, LEADBIZ_TERMS_URL, TRADE_LABEL } from "@/lib/chillbros/leadbiz/buyers";
import { SLUG_TRADE } from "@/lib/chillbros/leadbiz/catalog";
import { loadDelivery } from "@/lib/chillbros/leadbiz/delivery";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your lead pack · San Antonio New Openings", robots: { index: false, follow: false } };

type Props = { params: Promise<{ token: string }> };

// One buyer's licensed lead pack. Recorded on open, revocable by the owner, and stamped with
// the buyer's name on screen, in print and in the spreadsheet.
export default async function DeliveryPage({ params }: Props) {
  const { token } = await params;
  const d = await loadDelivery(token);
  const digits = LEADBIZ_PHONE.replace(/\D/g, "");
  if (!d) {
    return (
      <main className="grid min-h-dvh place-items-center bg-[#0B1E33] px-4 text-white">
        <div className="max-w-md rounded-2xl border border-white/10 bg-[#102A44] p-6">
          <h1 className="text-2xl font-bold">This link isn&apos;t active</h1>
          <p className="mt-3 text-[#C9D6E3]">The link is wrong, or access to this pack was turned off. If you bought a pack and think this is a mistake, text <a className="font-bold text-[#7FD4FF]" href={`sms:${digits}`}>{LEADBIZ_PHONE}</a>.</p>
        </div>
      </main>
    );
  }
  const who = d.buyerName ?? d.buyerEmail;
  const plural = TRADE_LABEL[SLUG_TRADE[d.trade]]?.plural ?? d.trade;
  const stamp = `Licensed to ${who} · Order ${d.squareRef} · Not for resale or sharing`;

  return (
    <main className="min-h-dvh bg-[#0B1E33] text-white print:bg-white print:text-black">
      <div className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#7FD4FF] print:text-black">San Antonio New Openings</p>
        <h1 className="mt-1 text-3xl font-bold">{d.productName} · {plural}</h1>
        <p className="mt-2 rounded-lg border border-[#F5C542]/50 bg-[#12304D] px-3 py-2 text-sm font-semibold text-[#F5C542] print:border-black print:bg-white print:text-black">{stamp}</p>
        <div className="mt-4 flex flex-wrap gap-2 print:hidden">
          <a href={`/lp/o/${token}/csv`} className="inline-flex min-h-11 items-center rounded-xl bg-[#F5C542] px-5 font-bold text-[#0B1E33]">Download spreadsheet</a>
          <span className="inline-flex min-h-11 items-center rounded-xl border border-white/15 px-4 text-sm text-[#C9D6E3]">Print or save as PDF from your browser menu</span>
        </div>

        <section className="mt-6 rounded-2xl border border-white/10 bg-[#102A44] p-4 text-[15px] text-[#C9D6E3] print:border-black print:bg-white print:text-black">
          <p className="font-bold text-white print:text-black">How to use it</p>
          <p className="mt-1">Call within 48 hours. Lead with their project, not your pitch, and ask who&apos;s handling your trade. Each project is shared with at most 3 {plural}.</p>
        </section>

        <h2 className="mt-8 text-xl font-bold uppercase tracking-wide">{d.projects.length} projects</h2>
        <ol className="mt-3 space-y-3">
          {d.projects.map((p, i) => (
            <li key={p.key} className="break-inside-avoid rounded-2xl border border-white/10 bg-[#102A44] p-4 print:border-black print:bg-white">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-lg font-bold">{i + 1}. {p.title}</p>
                <span className="text-xs uppercase tracking-wider text-[#7FD4FF] print:text-black">{p.industry === "auto" ? "Auto" : "Restaurant & retail"}</span>
              </div>
              <dl className="mt-2 grid grid-cols-[88px_1fr] gap-y-1 text-[15px] text-[#C9D6E3] print:text-black">
                <dt className="text-[#8A9BB0]">Address</dt><dd>{p.address}</dd>
                <dt className="text-[#8A9BB0]">Contact</dt><dd>{p.contact} · {p.role}</dd>
                <dt className="text-[#8A9BB0]">Phone</dt><dd><a className="font-semibold text-white print:text-black" href={`tel:${p.phone.replace(/\D/g, "")}`}>{p.phone}</a></dd>
                <dt className="text-[#8A9BB0]">Project</dt><dd>{p.project}</dd>
                <dt className="text-[#8A9BB0]">Timing</dt><dd>{p.timing}</dd>
                <dt className="text-[#8A9BB0]">Source</dt><dd><a className="underline underline-offset-2" href={p.source_url} rel="noopener noreferrer" target="_blank">TDLR {p.key}</a></dd>
                {p.fit ? <><dt className="text-[#8A9BB0]">Why it fits</dt><dd>{p.fit}</dd></> : null}
              </dl>
              {p.opener ? <p className="mt-3 rounded-xl bg-[#0F2740] p-3 text-[15px] leading-relaxed text-white print:bg-white print:text-black"><span className="mb-1 block text-xs uppercase tracking-wider text-[#7FD4FF] print:text-black">Call opener</span>&ldquo;{p.opener}&rdquo;</p> : null}
              {p.email ? <p className="mt-2 rounded-xl bg-[#0F2740] p-3 text-[15px] leading-relaxed whitespace-pre-line text-white print:bg-white print:text-black"><span className="mb-1 block text-xs uppercase tracking-wider text-[#7FD4FF] print:text-black">Email opener</span>{p.email}</p> : null}
            </li>
          ))}
        </ol>

        {d.contacts.length ? (
          <section className="mt-10">
            <h2 className="text-xl font-bold uppercase tracking-wide">{d.contacts.length} basic business contacts</h2>
            <p className="mt-1 text-sm text-[#8A9BB0]">Existing businesses (not new projects). Business data © OpenStreetMap contributors.</p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="text-[#8A9BB0]"><tr><th className="py-2 pr-3">Business</th><th className="pr-3">Phone</th><th className="pr-3">Type</th><th className="pr-3">Area</th><th>Address</th></tr></thead>
                <tbody>{d.contacts.map((c, i) => <tr key={i} className="border-t border-white/10"><td className="py-2 pr-3 font-semibold">{c.name}</td><td className="pr-3">{c.phone}</td><td className="pr-3">{c.type}</td><td className="pr-3">{c.area}</td><td>{c.address}</td></tr>)}</tbody>
              </table>
            </div>
          </section>
        ) : null}

        <footer className="mt-12 border-t border-white/10 pt-6 text-sm text-[#8A9BB0]">
          <p>{stamp}. This pack is licensed to your company only. Don&apos;t resell, forward or post it. <a className="underline" href={LEADBIZ_TERMS_URL}>Lead Pack Terms</a>.</p>
          <p className="mt-2">Project data from public Texas Department of Licensing and Regulation filings. Verify details before you quote.</p>
          <p className="mt-2">San Antonio New Openings, a service of Chill Professionals LLC · {LEADBIZ_PHONE} · satxnewopenings@gmail.com</p>
        </footer>
      </div>
    </main>
  );
}
