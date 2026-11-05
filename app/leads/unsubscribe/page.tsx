import { validOptOut } from "@/lib/lead-market/secrets";
import { emailAddress } from "@/lib/lead-market/rules";
export default async function Unsubscribe({ searchParams }: { searchParams: Promise<{ buyer?: string; email?: string; sig?: string }> }) {
  const q = await searchParams; const email = emailAddress(q.email);
  const valid = email && validOptOut(q.buyer || "", email, q.sig || "");
  return <section className="mx-auto max-w-lg space-y-5"><h1 className="text-3xl font-bold">Stop this business&apos;s outreach</h1>{valid ? <><p>Confirm below to stop future platform messages from this buyer business to {email}. No account is required.</p><form method="post" action={`/api/lead-market/unsubscribe?${new URLSearchParams({ buyer: q.buyer!, email: email!, sig: q.sig! })}`}><button className="rounded-xl bg-cyan-200 px-5 py-3 font-semibold text-slate-950">Unsubscribe</button></form></> : <p>This unsubscribe link is incomplete or invalid. Use the link in the original email.</p>}</section>;
}
