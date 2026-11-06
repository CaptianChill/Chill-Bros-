"use server";

import { revalidatePath } from "next/cache";

import { getOwnerProfile } from "@/lib/chillbros/sent-invoice-history";
import { createServiceRoleClient } from "@/lib/supabase/service-client";

/** Owner only: turn off one lead-pack link and free its project slots (after a refund, or if it was shared). */
export async function revokeLeadPackOrder(form: FormData) {
  const owner = await getOwnerProfile();
  if (!owner) throw new Error("Owner only");
  const id = String(form.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Bad order id");
  const { error } = await createServiceRoleClient().rpc("chillbros_leadpack_revoke", { p_order: id, p_reason: `Revoked by ${owner.fullName ?? "owner"}` });
  if (error) throw new Error(error.message);
  revalidatePath("/owner/lead-business");
}
