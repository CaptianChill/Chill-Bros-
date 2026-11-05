import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { OutreachReviewTime } from "@/components/outreach-review-time";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import { createServiceRoleClient } from "@/lib/supabase/service-client";
import { checkOutreachQualification } from "@/lib/chillbros/autopilot/qualification";
import { recordOutreachReview, registerOutreachBuyer } from "../../qualification-actions";

export const dynamic = "force-dynamic";
const input = "mt-1 min-h-11 w-full rounded-xl border border-cyan-400/30 bg-black/50 px-3 py-2 text-white";

export default async function QualificationPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ sender?: string }> }) {
  const profile = await getCurrentStaffProfile();
  if (!profile || profile.role !== "manager") redirect("/revenue-radar");
  const { id } = await params;
  const sender = (await searchParams).sender || "chill-pros";
  const client = createServiceRoleClient();
  const [{ data: lead }, { data: senders, error: senderError }, { data: reviews, error: reviewError }, snapshotResult] = await Promise.all([
    client.from("chillbros_revenue_prospects").select("business_name,business_address,contact_email,contact_name,contact_role,source_url").eq("id", id).maybeSingle(),
    client.from("chillbros_outreach_senders").select("sender_key,display_name,approval_hold,transport_ready").order("display_name"),
    client.from("chillbros_outreach_reviews").select("id,verdict,tier,created_at,contact_evidence,source_rights_evidence,need_evidence").eq("prospect_id", id).eq("sender_key", sender).order("created_at", { ascending: false }).limit(10),
    client.rpc("chillbros_outreach_review_snapshot", { prospect_id_input: id }),
  ]);
  if (!lead) notFound();
  if (senderError || reviewError || snapshotResult.error || !snapshotResult.data) return <AppShell title="Outreach review" description="Sending stays blocked until evidence checks are available."><p>Outreach review is unavailable. No approval can be saved.</p></AppShell>;
  const decision = await checkOutreachQualification(client, id, sender);
  const selected = senders?.find((s) => s.sender_key === sender);
  const dateField = (name: string, label: string) => <OutreachReviewTime name={name} label={label} className={input} />;
  return <AppShell title={`${lead.business_name}: outreach review`} description="Policy v1 · sender-specific evidence before every automated cold email."><div className="mx-auto max-w-3xl space-y-5 text-left">
    <Link href={`/revenue-radar/${id}`} className="text-cyan-200">← Lead detail</Link>
    <p className="text-sm text-zinc-300">Discovery and scores never approve outreach. Contact and source reviews expire after 30 days; confirmed needs expire after 7 days. Changed business or contact evidence requires another review. A researched prospect has no confirmed buying intent.</p>
    <nav aria-label="Outreach sender" className="flex flex-wrap gap-3">{senders?.map((s) => <Link key={s.sender_key} href={`/revenue-radar/${id}/qualification?sender=${encodeURIComponent(s.sender_key)}`} className={`rounded-xl border px-3 py-2 ${sender === s.sender_key ? "border-cyan-300 text-cyan-100" : "border-white/20"}`}>{s.display_name}{s.approval_hold || !s.transport_ready ? " (held)" : ""}</Link>)}</nav>
    <section className="rounded-2xl border border-cyan-300/30 p-4"><h2 className="font-semibold">{selected?.display_name || "Unknown sender"}: {decision.eligible ? "Eligible under policy v1" : "Blocked"}</h2><ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{decision.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>{decision.expires_at ? <p className="mt-2 text-sm">Evidence expires: {new Date(decision.expires_at).toLocaleString("en-US", { timeZone: "America/Chicago" })} Central</p> : null}</section>
    <section className="rounded-2xl border border-white/15 p-4 text-sm"><p>{lead.business_address || "No business address"}</p><p>{lead.contact_email || "No email"} · {lead.contact_name || "No named contact"} · {lead.contact_role || "No role recorded"}</p><p className="mt-2 break-all">Source: {lead.source_url}</p><p className="mt-2 text-amber-100">Record actual research evidence. MX records, a high score, or a permit alone do not confirm a mailbox, decision-maker, or service need. This form does not establish resale rights for you.</p></section>
    {selected ? <form action={recordOutreachReview} className="space-y-4 rounded-2xl border border-cyan-300/30 p-4">
      <input type="hidden" name="lead_id" value={id} /><input type="hidden" name="sender_key" value={sender} /><input type="hidden" name="snapshot" value={JSON.stringify(snapshotResult.data)} />
      <label className="block">Review outcome<select className={input} name="verdict" defaultValue="blocked"><option value="blocked">Block / revoke prior approval</option><option value="approved">Approve reviewed evidence</option></select></label>
      <label className="block">Evidence tier<select className={input} name="tier" defaultValue="researched_prospect"><option value="researched_prospect">Researched prospect — buying intent unknown</option><option value="confirmed_need">Current need confirmed by the business</option></select></label>
      {dateField("contact_checked_at", "Contact checked at")}
      <label className="block">Contact evidence<textarea className={input} name="contact_evidence" maxLength={4000} rows={3} placeholder="Exact source URL or call reference, recipient/department, verification method and result. MX alone is insufficient." /></label>
      {dateField("source_checked_at", "Source rights checked at")}
      <label className="block">Source-use evidence<textarea className={input} name="source_rights_evidence" maxLength={4000} rows={3} placeholder="License/permission reference covering the exact use, including any required attribution and redistribution terms." /></label>
      {dateField("need_confirmed_at", "Need confirmed at (confirmed-need tier only)")}
      <label className="block">Current-need evidence<textarea className={input} name="need_evidence" maxLength={4000} rows={3} placeholder="Who confirmed the problem, equipment, timing and the call/message reference. A directory listing or construction permit is insufficient." /></label>
      {[["location_verified", "I checked this exact business location and duplicate records."], ["role_verified", "I verified this recipient handles or routes equipment/vendor requests."], ["outreach_permitted", "The documented source permits this sender's proposed outreach use."], ["resale_permitted", "The documented source permits resale to this buyer (required for buyers)."], ["sharing_permitted", "Permission to share this contact with the named buyer is documented (required for buyers)."]].map(([name, label]) => <label key={name} className="flex items-start gap-2 text-sm"><input className="mt-1" type="checkbox" name={name} />{label}</label>)}
      <p className="text-xs text-zinc-400">Saving evidence does not release the global hold, configure a buyer transport, or send email. Reviews are retained; blocking creates a new review.</p>
      <button className="min-h-12 rounded-xl bg-cyan-300 px-4 font-bold text-black">Save review</button>
    </form> : null}
    <section className="space-y-3"><h2 className="font-semibold">Recent reviews for this sender</h2>{reviews?.map((r) => <article key={r.id} className="rounded-xl border border-white/15 p-3 text-sm"><p>{r.verdict} · {r.tier.replaceAll("_", " ")} · {new Date(r.created_at).toLocaleString("en-US", { timeZone: "America/Chicago" })} Central</p><p className="mt-2 whitespace-pre-wrap">Contact: {r.contact_evidence}</p><p className="mt-2 whitespace-pre-wrap">Source rights: {r.source_rights_evidence}</p>{r.need_evidence ? <p className="mt-2 whitespace-pre-wrap">Need: {r.need_evidence}</p> : null}</article>)}</section>
    <details className="rounded-xl border border-white/15 p-4"><summary>Register a lead buyer for separate review</summary><form action={registerOutreachBuyer} className="mt-3 space-y-3"><label className="block">Buyer business name<input className={input} name="display_name" required maxLength={160} /></label><label className="block">Buyer key<input className={input} name="sender_key" required pattern="buyer-[a-z0-9-]{3,70}" placeholder="buyer-example-company" /></label><p className="text-sm text-zinc-400">Buyer reviews stay held. Separate buyer authentication, sending credentials, postal identity, delivery terms and transport verification must be configured before buyer outreach can be enabled.</p><button className="min-h-11 rounded-xl border border-cyan-300 px-4">Register held buyer</button></form></details>
  </div></AppShell>;
}
