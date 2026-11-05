import "server-only";
import type { createServiceRoleClient } from "@/lib/supabase/service-client";

export type OutreachDecision = {
  eligible: boolean;
  reasons: string[];
  policy_version?: string;
  review_id?: string | null;
  tier?: string | null;
  expires_at?: string | null;
};

function validDecision(data: unknown): data is OutreachDecision {
  if (!data || typeof data !== "object") return false;
  const result = data as OutreachDecision;
  return typeof result.eligible === "boolean" && Array.isArray(result.reasons)
    && result.reasons.every((reason) => typeof reason === "string")
    && (!result.eligible || (result.policy_version === "v1" && typeof result.review_id === "string" && result.review_id.length > 0 && result.reasons.length === 0));
}

/** Database policy is canonical; missing migrations, errors and malformed replies block. */
export async function checkOutreachQualification(client: ReturnType<typeof createServiceRoleClient>, prospectId: string, senderKey = "chill-pros"): Promise<OutreachDecision> {
  const { data, error } = await client.rpc("chillbros_outreach_policy_check", { prospect_id_input: prospectId, sender_key_input: senderKey });
  if (error || !validDecision(data)) {
    throw new Error("Outreach evidence checks unavailable; sending is blocked.");
  }
  return data as OutreachDecision;
}

/** One RPC for the queue; reservations still recheck the same policy under locks. */
export async function checkOutreachBatch(client: ReturnType<typeof createServiceRoleClient>, prospectIds: string[], senderKey = "chill-pros"): Promise<Record<string, OutreachDecision>> {
  if (!prospectIds.length) return {};
  const { data, error } = await client.rpc("chillbros_outreach_policy_batch", { prospect_ids: prospectIds, sender_key_input: senderKey });
  if (error || !data || typeof data !== "object" || Array.isArray(data)
    || prospectIds.some((id) => !Object.hasOwn(data, id) || !validDecision(data[id]))) {
    throw new Error("Outreach evidence checks unavailable; sending is blocked.");
  }
  return data as Record<string, OutreachDecision>;
}
