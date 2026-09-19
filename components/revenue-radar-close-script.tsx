"use client";

import { useMemo, useState } from "react";

type Props = {
  businessName: string;
  serviceLine: string;
  signalSummary: string;
  signalVerified: boolean;
  contactName?: string | null;
};

const serviceNames: Record<string, string> = {
  hvac_r: "commercial HVAC/R",
  refrigeration: "commercial refrigeration",
  ice_machine: "ice-machine service",
  kitchen_equipment: "commercial kitchen equipment",
  exhaust_hood: "hood and exhaust service",
  multiple: "HVAC/R, refrigeration, ice machines, kitchen equipment, and hood/exhaust service",
};

export function RevenueRadarCloseScript({
  businessName,
  serviceLine,
  signalSummary,
  signalVerified,
  contactName,
}: Props) {
  const [scope, setScope] = useState<"recommended" | "single">("recommended");
  const [setting, setSetting] = useState<"phone" | "in_person">("phone");
  const [copied, setCopied] = useState(false);
  const service = serviceNames[serviceLine] ?? "commercial equipment service";

  const script = useMemo(() => {
    const greeting = contactName ? `Hi ${contactName},` : "Hi,";
    const intro = `${greeting} this is [YOUR NAME] with Chill Bros. We help San Antonio businesses keep their HVAC, refrigeration, ice, kitchen, and exhaust equipment running without having to chase multiple service companies.`;
    const reason = signalVerified
      ? `I’m reaching out because we found a current service signal for ${businessName}: ${signalSummary}`
      : `I’m reaching out because ${businessName} fits the type of commercial operation we support. I’m not assuming you have a problem today; I wanted to make sure you have a reliable local option before an equipment issue turns into downtime.`;
    const offer = scope === "recommended"
      ? `We can cover the full account, including ${serviceNames.multiple}. If you already have some equipment covered, we can simply handle the gaps instead of replacing anything that is working for you.`
      : `If ${service} is the only thing you need help with, that is completely fine. We can start with that one service or even one specific piece of equipment and earn the rest of the work over time.`;
    const close = setting === "phone"
      ? `What would be easier: schedule a quick service/site visit, or start by telling me which piece of equipment gives you the most trouble?`
      : `Since I’m here, what is the one piece of equipment or service you would most want a dependable backup company for? We can start there and keep it simple.`;
    return [intro, reason, offer, close].join("\n\n");
  }, [businessName, contactName, scope, service, setting, signalSummary, signalVerified]);

  async function copyScript() {
    await navigator.clipboard.writeText(script);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return <section className="rounded-2xl border border-cyan-300/35 bg-cyan-400/5 p-4 shadow-[0_0_26px_rgba(34,211,238,0.08)]">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200">Sales close</p>
        <h2 className="mt-1 text-lg font-bold text-white">What to say next</h2>
        <p className="mt-1 text-xs text-zinc-400">Use it as written or make it sound natural. Never claim an unverified problem is confirmed.</p>
      </div>
      <button type="button" onClick={copyScript} className="min-h-10 rounded-xl border border-cyan-300/40 px-3 text-sm font-semibold text-cyan-100">
        {copied ? "Copied" : "Copy pitch"}
      </button>
    </div>

    <div className="mt-4 grid grid-cols-2 gap-2">
      <button type="button" onClick={() => setScope("recommended")} className={`min-h-10 rounded-xl border px-3 text-sm font-semibold ${scope === "recommended" ? "border-cyan-300 bg-cyan-300 text-black" : "border-white/10 bg-black/30 text-zinc-300"}`}>Full account</button>
      <button type="button" onClick={() => setScope("single")} className={`min-h-10 rounded-xl border px-3 text-sm font-semibold ${scope === "single" ? "border-cyan-300 bg-cyan-300 text-black" : "border-white/10 bg-black/30 text-zinc-300"}`}>One service / unit</button>
      <button type="button" onClick={() => setSetting("phone")} className={`min-h-9 rounded-xl border px-3 text-xs font-medium ${setting === "phone" ? "border-cyan-400/70 bg-cyan-400/15 text-cyan-100" : "border-white/10 text-zinc-400"}`}>Phone</button>
      <button type="button" onClick={() => setSetting("in_person")} className={`min-h-9 rounded-xl border px-3 text-xs font-medium ${setting === "in_person" ? "border-cyan-400/70 bg-cyan-400/15 text-cyan-100" : "border-white/10 text-zinc-400"}`}>In person</button>
    </div>

    <div className="mt-4 whitespace-pre-line rounded-xl border border-white/10 bg-black/35 p-4 text-sm leading-6 text-zinc-200">
      {script}
    </div>
  </section>;
}
