import Link from "next/link";
import { redirect } from "next/navigation";
import { marketSession } from "@/lib/lead-market/auth";
import { currentBuyer } from "@/lib/lead-market/store";
import { MarketForm } from "@/components/lead-market/form";
import { registerBuyer } from "../actions";
export default async function Join() {
  const session = await marketSession(); if (!session) redirect("/leads/sign-in");
  if (await currentBuyer()) redirect("/leads/account");
  return <section className="mx-auto max-w-xl space-y-6"><h1 className="text-3xl font-bold">Tell us about your business</h1><p className="text-slate-300">Signed in as {session.email}. Your business profile is reviewed before purchasing or outreach is enabled.</p><MarketForm action={registerBuyer} submit="Create my buyer profile"><label className="block">Business name<input className="market-input" name="company_name" minLength={2} maxLength={160} required /></label><label className="block">Business postal address<textarea className="market-input" name="postal_address" minLength={10} maxLength={500} required /></label><label className="flex items-start gap-3"><input type="checkbox" name="terms" required /><span>I accept the <Link className="underline" href="/leads/terms">buyer terms</Link> and have read the <Link className="underline" href="/leads/privacy">privacy notice</Link>.</span></label></MarketForm></section>;
}
