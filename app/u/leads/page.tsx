import type { Metadata } from "next";

import { UnsubscribeButton } from "@/components/autopilot/unsubscribe-button";

export const dynamic = "force-dynamic";
// Contractor buyers land here from the lead business's emails, so it carries that brand only
// (no HVAC company frame, logo or app icon).
const ICON = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#0B1E33"/><path d="M14 46V18h6l12 17V18h6v28h-6L20 29v17z" fill="#FF7A59"/><circle cx="48" cy="20" r="5" fill="#F5C542"/></svg>')}`;
export const metadata: Metadata = {
  title: "San Antonio New Openings · Unsubscribe",
  robots: { index: false },
  applicationName: "San Antonio New Openings",
  manifest: null,
  appleWebApp: { capable: false, title: "SA New Openings" },
  icons: { icon: ICON, apple: ICON, shortcut: ICON },
  other: { "apple-mobile-web-app-title": "SA New Openings", "mobile-web-app-capable": "no", "apple-mobile-web-app-capable": "no" },
};

// Unsubscribe for the lead business's contractor emails (same signed links and suppression list as /u).
export default async function LeadsUnsubscribePage({ searchParams }: { searchParams: Promise<{ c?: string; s?: string }> }) {
  const { c = "", s = "" } = await searchParams;
  return (
    <main className="min-h-dvh bg-[#0B1E33] px-4 py-8 text-white">
      <div className="mx-auto max-w-md">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#7FD4FF]">San Antonio</p>
        <p className="text-xl font-bold uppercase tracking-wide">New Openings</p>
        <section className="mt-6 rounded-2xl bg-white p-5 text-[#0B1E33]">
          <h1 className="text-2xl font-bold">Unsubscribe</h1>
          <p className="mt-2 mb-5 text-[15px] text-[#3D5170]">Stop San Antonio New Openings emails to <strong>{c || "this address"}</strong>.</p>
          <UnsubscribeButton contact={c} signature={s} brand="San Antonio New Openings" />
        </section>
      </div>
    </main>
  );
}
