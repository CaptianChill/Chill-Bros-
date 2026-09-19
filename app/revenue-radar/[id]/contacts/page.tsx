import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import { createServiceRoleClient } from "@/lib/supabase/service-client";
import { createRevenueContact, markRevenueContactDoNotContact, setPrimaryRevenueContact } from "../../contact-actions";

export const dynamic = "force-dynamic";
const input = "min-h-11 w-full rounded-xl border border-cyan-400/30 bg-black/50 px-3 py-2 text-white";

export default async function RevenueContactsPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await getCurrentStaffProfile();
  if (!profile || !["manager", "office"].includes(profile.role)) redirect("/");
  const { id } = await params;
  const client = createServiceRoleClient();
  const [{ data: lead }, { data: contacts, error }] = await Promise.all([
    client.from("chillbros_revenue_prospects").select("id,business_name,contact_name,contact_role,contact_phone,contact_email,do_not_contact").eq("id", id).maybeSingle(),
    client.from("chillbros_revenue_contacts").select("id,name,role,phone,email,verification_status,source,preferred_contact_method,is_primary,do_not_contact,do_not_contact_reason,notes,created_at").eq("lead_id", id).order("is_primary", { ascending: false }).order("created_at", { ascending: true }),
  ]);
  if (!lead) notFound();
  if (error) return <AppShell title={`${lead.business_name} Contacts`} description="Revenue Radar decision-maker records."><div className="mx-auto max-w-4xl text-left"><p className="rounded-2xl border border-amber-300/30 bg-amber-400/5 p-4 text-amber-100">Multi-contact records are waiting for the additive Sales Command migration.</p></div></AppShell>;

  return <AppShell title={`${lead.business_name} Contacts`} description="Keep decision makers, sources, verification, and contact restrictions separate and auditable."><div className="mx-auto max-w-4xl space-y-5 text-left">
    <Link href={`/revenue-radar/${id}`} className="text-cyan-200">← Lead Detail</Link>
    {lead.do_not_contact ? <p className="rounded-xl border border-red-300/30 bg-red-400/5 p-3 text-sm font-semibold text-red-100">This entire lead is Do Not Contact. Contact records remain visible for audit only.</p> : null}

    <section className="space-y-3">
      {(contacts ?? []).map((contact) => <article key={contact.id} className={`rounded-2xl border p-4 ${contact.do_not_contact ? "border-red-300/25 bg-red-400/5" : contact.is_primary ? "border-cyan-300/35 bg-cyan-400/5" : "border-white/10 bg-black/30"}`}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div><h2 className="font-bold text-white">{contact.name || "Unnamed contact"}</h2><p className="text-sm text-zinc-400">{contact.role || "Role unknown"} · {contact.verification_status.replaceAll("_", " ")}</p></div>
          <div className="flex gap-2">{contact.is_primary ? <span className="rounded-full border border-cyan-300/30 px-2 py-1 text-xs text-cyan-200">Primary</span> : null}{contact.do_not_contact ? <span className="rounded-full border border-red-300/30 px-2 py-1 text-xs text-red-200">Do Not Contact</span> : null}</div>
        </div>
        <div className="mt-3 grid gap-1 text-sm sm:grid-cols-2"><p><span className="text-zinc-500">Phone:</span> {contact.phone || "Not recorded"}</p><p><span className="text-zinc-500">Email:</span> {contact.email || "Not recorded"}</p><p><span className="text-zinc-500">Source:</span> {contact.source || "Not recorded"}</p><p><span className="text-zinc-500">Preferred:</span> {contact.preferred_contact_method || "Not recorded"}</p></div>
        {contact.notes ? <p className="mt-2 text-sm text-zinc-300">{contact.notes}</p> : null}
        {contact.do_not_contact_reason ? <p className="mt-2 text-sm text-red-200">DNC reason: {contact.do_not_contact_reason}</p> : null}
        {!contact.do_not_contact ? <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {!contact.is_primary ? <form action={setPrimaryRevenueContact}><input type="hidden" name="lead_id" value={id} /><input type="hidden" name="contact_id" value={contact.id} /><button className="min-h-10 w-full rounded-xl border border-cyan-300/40 px-3 text-sm font-semibold text-cyan-100">Make Primary</button></form> : <div />}
          <form action={markRevenueContactDoNotContact} className="flex gap-2"><input type="hidden" name="lead_id" value={id} /><input type="hidden" name="contact_id" value={contact.id} /><input className={input} name="reason" required placeholder="DNC reason" /><button className="rounded-xl border border-red-300/30 px-3 text-sm font-semibold text-red-100">DNC</button></form>
        </div> : null}
      </article>)}
      {(contacts ?? []).length === 0 ? <p className="rounded-2xl border border-white/10 p-5 text-center text-zinc-500">No structured contacts yet. Add the first decision-maker record below.</p> : null}
    </section>

    <section className="rounded-2xl border border-cyan-300/20 bg-black/35 p-4">
      <h2 className="font-semibold text-white">Add contact</h2>
      <form action={createRevenueContact} className="mt-3 grid gap-3 sm:grid-cols-2">
        <input type="hidden" name="lead_id" value={id} />
        <label>Name<input className={input} name="name" /></label>
        <label>Role<input className={input} name="role" /></label>
        <label>Phone<input className={input} name="phone" type="tel" /></label>
        <label>Email<input className={input} name="email" type="email" /></label>
        <label>Verification<select className={input} name="verification_status" defaultValue="unverified"><option value="unverified">Unverified</option><option value="customer_reported">Customer reported</option><option value="source_verified">Source verified</option><option value="verified">Verified</option></select></label>
        <label>Preferred contact<select className={input} name="preferred_contact_method" defaultValue=""><option value="">Not set</option><option value="phone">Phone</option><option value="email">Email</option><option value="text">Text</option></select></label>
        <label className="sm:col-span-2">Source<input className={input} name="source" placeholder="Customer call, company website, public source, referral..." /></label>
        <label className="sm:col-span-2">Notes<input className={input} name="notes" /></label>
        <label className="flex items-center gap-2 sm:col-span-2"><input type="checkbox" name="is_primary" />Make this the primary outreach contact</label>
        <button className="min-h-12 rounded-xl bg-cyan-300 px-4 font-bold text-black sm:col-span-2">Add Contact</button>
      </form>
    </section>
  </div></AppShell>;
}
