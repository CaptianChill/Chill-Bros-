import Link from "next/link";
import type { ReactNode } from "react";
import { marketSettings } from "@/lib/lead-market/store";
export const dynamic = "force-dynamic";
export default async function MarketLayout({ children }: { children: ReactNode }) {
  const settings = await marketSettings();
  return <div className="min-h-dvh bg-[#060e19] text-slate-100"><header className="border-b border-cyan-200/15"><div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-5"><Link href="/leads" className="text-lg font-bold tracking-tight text-cyan-100">{settings.brand_name}{!settings.sales_enabled ? <span className="ml-2 text-xs font-normal text-slate-400">Early access</span> : null}</Link><nav aria-label="Marketplace" className="flex gap-5 text-sm"><Link href="/leads/browse">Browse</Link><Link href="/leads/account">My leads</Link><Link href="/leads/mailbox">My mailbox</Link><Link href="/leads/sign-in">Sign in</Link></nav></div></header><main className="mx-auto max-w-6xl px-5 py-10">{children}</main><footer className="mx-auto flex max-w-6xl flex-wrap gap-5 border-t border-white/10 px-5 py-7 text-sm text-slate-400"><Link href="/leads/terms">Buyer terms</Link><Link href="/leads/privacy">Privacy</Link><span>Source-backed prospects. No guaranteed jobs or buying intent.</span></footer></div>;
}
