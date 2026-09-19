import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import { createServiceRoleClient } from "@/lib/supabase/service-client";
import { buildTextPdf } from "@/lib/chillbros/simple-pdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const text = (value: unknown) => typeof value === "string" ? value : "";
const list = (value: unknown) => Array.isArray(value) ? value.map((item) => String(item)) : [];

function filename(value: string) {
  const clean = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
  return `${clean || "revenue-radar"}-battle-card.pdf`;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getCurrentStaffProfile();
  if (!profile || !["manager", "office"].includes(profile.role)) return new Response("Sales access required.", { status: 403 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Invalid lead.", { status: 400 });

  const client = createServiceRoleClient();
  const [{ data: lead, error: leadError }, { data: card, error: cardError }] = await Promise.all([
    client.from("chillbros_revenue_prospects").select("id,business_name,city,score,service_line,signal_verified,source_url,sales_status,assigned_salesperson").eq("id", id).maybeSingle(),
    client.from("chillbros_revenue_battle_cards").select("id,content,prompt_version,created_at").eq("lead_id", id).eq("is_current", true).maybeSingle(),
  ]);
  if (leadError || !lead) return new Response(leadError?.message || "Lead not found.", { status: 404 });
  if (profile.role === "office" && lead.assigned_salesperson !== profile.id) return new Response("This lead is not assigned to you.", { status: 403 });
  if (cardError || !card) return new Response(cardError?.message || "Save a Battle Card before exporting it.", { status: 409 });

  const content = (card.content ?? {}) as Record<string, unknown>;
  const verifiedFacts = list(content.verifiedFacts);
  const inferences = list(content.reasonableInferences);
  const missing = list(content.missingInformation);
  const discovery = list(content.discoveryQuestions);
  const buying = list(content.buyingSignals);
  const objections = Array.isArray(content.objectionResponses) ? content.objectionResponses as Array<Record<string, unknown>> : [];
  const lines: string[] = [
    "CHILL PROS - REVENUE RADAR SALES BATTLE CARD",
    "",
    `Business: ${lead.business_name}`,
    `Location: ${lead.city}`,
    `Lead score: ${lead.score}/100`,
    `Sales status: ${lead.sales_status || "new"}`,
    `Service line: ${String(lead.service_line).replaceAll("_", " ")}`,
    `Battle Card version: ${card.id}`,
    `Prompt version: ${card.prompt_version}`,
    `Generated: ${new Date(card.created_at).toLocaleString()}`,
    `Source: ${lead.source_url}`,
    "",
    "VERIFIED FACTS",
    ...verifiedFacts.map((item) => `- ${item}`),
    "",
    "REASONABLE INFERENCES - VERIFY BEFORE USING AS FACT",
    ...inferences.map((item) => `- ${item}`),
    "",
    "MISSING INFORMATION",
    ...missing.map((item) => `- ${item}`),
    "",
    "WHY NOW",
    text(content.whyNow),
    "",
    "BEST CONTACT",
    text(content.primaryContactRole),
    "",
    "SERVICE ANGLE",
    text(content.serviceAngle),
    "",
    "CALL OPENER",
    text(content.callOpener),
    "",
    "DISCOVERY QUESTIONS",
    ...discovery.map((item, index) => `${index + 1}. ${item}`),
    "",
    "BUYING SIGNALS",
    ...buying.map((item) => `- ${item}`),
    "",
    "OBJECTIONS AND RESPONSES",
    ...objections.flatMap((item) => [`Objection: ${text(item.objection)}`, `Response: ${text(item.response)}`]),
    "",
    "BEST NEXT STEP",
    text(content.bestNextStep),
    "",
    "TECHNICIAN HANDOFF",
    text(content.technicalHandoff),
    "",
    "FOLLOW-UP PLAN",
    text(content.followUpPlan),
    "",
    "SAFETY NOTE",
    "Customer statements are customer-reported. Sales Assist does not diagnose equipment or promise technical outcomes.",
  ];

  const pdf = buildTextPdf(lines);
  const { error: auditError } = await client.from("chillbros_revenue_history").insert({
    lead_id: id,
    entity_type: "battle_card",
    entity_id: card.id,
    action: "pdf_exported",
    actor_id: profile.id,
    actor_type: "user",
    new_value: { battleCardVersion: card.id, promptVersion: card.prompt_version, exportedAt: new Date().toISOString() },
  });
  if (auditError) return new Response(`Could not record export audit: ${auditError.message}`, { status: 500 });

  return new Response(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${filename(lead.business_name)}"`,
      "cache-control": "no-store",
    },
  });
}
