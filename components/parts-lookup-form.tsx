"use client";
import { useState, useTransition } from "react";
import { lookupParts, type PartsLookupResult } from "@/app/parts-lookup/actions";

const input = "min-h-12 w-full rounded-xl border border-[#2d7dff]/25 bg-black px-3 py-2.5 text-base normal-case tracking-normal text-white placeholder:text-zinc-500";
const label = "text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400";
const card = "rounded-2xl border border-[#2d7dff]/25 bg-black/40 p-4 sm:p-5";
const link = "inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#8ffafa] underline underline-offset-4";
function SourceLink({ url, children }: { url: string; children: React.ReactNode }) {
  return <a href={url} target="_blank" rel="noopener noreferrer" className={link}>{children} <span aria-hidden="true">↗</span></a>;
}
export type PartsLookupPrefill = { brand?: string; model?: string; serial?: string; details?: string };

export function PartsLookupForm({ prefill = {} }: { prefill?: PartsLookupPrefill } = {}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<Extract<PartsLookupResult, { ok: true }> | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState("parts");
  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const selectedMode = submitter?.value === "manuals" ? "manuals" : "parts";
    formData.set("mode", selectedMode);
    setMode(selectedMode); setError(""); setResult(null);
    setQuery([formData.get("brand"), formData.get("model"), formData.get("serial") ? `Serial ${formData.get("serial")}` : "Serial not supplied"].join(" · "));
    startTransition(async () => {
      try {
        const outcome = await lookupParts(formData);
        if (!outcome.ok) { setError(outcome.error); return; }
        setResult(outcome);
      } catch { setError("The connection was interrupted. Your equipment details are still here; retry the search."); }
    });
  }
  return <div className="space-y-5">
    <div className="flex flex-wrap gap-2 text-xs font-semibold text-[#8ffafa]">
      <span className="rounded-full border border-[#8ffafa]/30 px-3 py-1.5">Live web research</span>
      <span className="rounded-full border border-[#8ffafa]/30 px-3 py-1.5">OEM manuals & diagrams</span>
      <span className="rounded-full border border-[#8ffafa]/30 px-3 py-1.5">Parts desk contacts</span>
    </div>
    <form onSubmit={onSubmit} className="space-y-4">
      <fieldset disabled={pending} className="grid gap-3 sm:grid-cols-2 disabled:opacity-60">
        <legend className="sr-only">Equipment to research</legend>
        <label className={label}>Brand / manufacturer<input name="brand" defaultValue={prefill.brand} required maxLength={120} placeholder="e.g. Carrier, True, Hoshizaki" className={`${input} mt-1.5`} /></label>
        <label className={label}>Model number<input name="model" defaultValue={prefill.model} required maxLength={120} placeholder="Enter the complete model" className={`${input} mt-1.5`} /></label>
        <label className={label}>Serial number (optional)<input name="serial" defaultValue={prefill.serial} maxLength={120} placeholder="Used to check serial breaks" className={`${input} mt-1.5`} /></label>
        <label className={label}>Part needed / symptom<input name="details" defaultValue={prefill.details} maxLength={1000} placeholder="e.g. water inlet valve" className={`${input} mt-1.5`} /></label>
      </fieldset>
      <div className="flex flex-col gap-3 sm:flex-row">
        <button name="mode" value="parts" disabled={pending} className="min-h-12 rounded-xl border border-[#8ffafa]/50 bg-[#2d7dff]/25 px-6 py-3 text-sm font-semibold text-white disabled:opacity-50">{pending && mode === "parts" ? "Researching parts…" : "Research this part"}</button>
        <button name="mode" value="manuals" disabled={pending} className="min-h-12 rounded-xl border border-white/25 bg-white/5 px-6 py-3 text-sm font-semibold text-white disabled:opacity-50">{pending && mode === "manuals" ? "Finding manuals…" : "Find parts manual"}</button>
      </div>
      <p className="text-sm leading-6 text-zinc-400">Checks manufacturer documents and parts suppliers. Add the full serial number to help identify revisions; confirm fit before ordering. Research can take up to a few minutes.</p>
    </form>
    {pending ? <p role="status" className={`${card} text-sm text-[#8ffafa]`}>Searching the web for {query}. Checking manuals, part references and contact pages…</p> : null}
    {error ? <p role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</p> : null}
    {result ? <div className="space-y-4" aria-live="polite">
      <section className={card}>
        <p className="text-xs font-semibold uppercase tracking-widest text-[#8ffafa]">Research results</p>
        <h3 className="mt-2 text-lg font-semibold text-white">{query}</h3>
        <p className="mt-2 text-sm leading-6 text-zinc-200">{result.data.summary}</p>
        <p className="mt-3 rounded-xl border border-amber-400/25 bg-amber-400/5 p-3 text-sm leading-6 text-amber-100"><strong>Serial & fit check: </strong>{result.data.serialCheck}</p>
      </section>
      <section className={card}>
        <h3 className="text-lg font-semibold text-white">Parts manuals & diagrams</h3>
        {result.data.manuals.length ? result.data.manuals.map((manual, i) => <article key={`${manual.url}-${i}`} className="mt-3 rounded-xl border border-white/10 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#8ffafa]">{manual.kind}</p>
          <h4 className="mt-1 font-semibold text-white">{manual.title}</h4>
          <p className="mt-2 text-sm leading-6 text-zinc-300">{manual.applicability}</p>
          <SourceLink url={manual.url}>{manual.kind === "Manual lookup portal" ? "Open lookup portal" : "Open manual"}</SourceLink>
        </article>) : <p className="mt-2 text-sm leading-6 text-zinc-300">No sourced manual link was found for this model. Ask the parts desk for the correct parts list and serial revision.</p>}
      </section>
      <section className={card}>
        <h3 className="text-lg font-semibold text-white">Part references</h3>
        {result.data.parts.length ? result.data.parts.map((part, i) => <article key={`${part.partNumber}-${i}`} className="mt-3 rounded-xl border border-white/10 p-4">
          <h4 className="font-semibold text-white">{part.name} <span className="text-[#8ffafa]">{part.partNumber}</span></h4>
          <p className="mt-2 text-sm leading-6 text-zinc-300">{part.evidence}</p>
          <SourceLink url={part.url}>View supporting source</SourceLink>
        </article>) : <p className="mt-2 text-sm leading-6 text-zinc-300">{mode === "manuals" ? "Manual lookup completed. Enter a specific part or symptom to research part numbers." : "No source-backed part number was found. Use the contacts below with your model, serial and requested part."}</p>}
      </section>
      {result.data.contacts.length ? <section className={card}>
        <h3 className="text-lg font-semibold text-white">Call the parts desk</h3>
        {result.data.contacts.map((contact, i) => <article key={`${contact.phone}-${i}`} className="mt-3 rounded-xl border border-white/10 p-4">
          <h4 className="font-semibold text-white">{contact.name}</h4>
          <a className="inline-flex min-h-12 items-center text-lg font-semibold text-[#8ffafa] underline" href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`}>{contact.phone}</a>
          <p className="text-sm leading-6 text-zinc-300">{contact.note}</p>
          <SourceLink url={contact.url}>Contact source</SourceLink>
        </article>)}
      </section> : null}
      {result.data.nextSteps.length ? <section className={card}><h3 className="text-lg font-semibold text-white">Before ordering</h3><ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-6 text-zinc-300">{result.data.nextSteps.map((step, i) => <li key={i}>{step}</li>)}</ul></section> : null}
      <details className={card}><summary className="cursor-pointer text-sm font-semibold text-zinc-300">Research sources · {result.data.sources.length} · {new Date(result.data.searchedAt).toLocaleDateString()}</summary><ul className="mt-3 space-y-2 break-words">{result.data.sources.map(source => <li key={source.url}><SourceLink url={source.url}>{source.title}</SourceLink></li>)}</ul></details>
    </div> : null}
    {error || (result && !result.data.contacts.length) ? <aside className={card}>
      <h3 className="font-semibold text-white">Commercial kitchen parts fallback</h3>
      <p className="mt-2 text-sm leading-6 text-zinc-300">Parts Town customer service can help route foodservice equipment parts requests. Have your brand, model, serial and part description ready.</p>
      <a href="tel:18004388898" className={link}>800-438-8898</a><br />
      <SourceLink url="https://www.partstown.com/contact-us">Parts Town contact page</SourceLink>
    </aside> : null}
  </div>;
}
