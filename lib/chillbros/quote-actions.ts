"use server";

import { revalidatePath } from "next/cache";

import { createEstimateV2Action, type EstimateAdjustments, type EstimateDraftLine } from "@/lib/chillbros/estimate-actions-v2";
import { routeApprovedJob } from "@/lib/chillbros/approved-job-routing";
import { addJobPartAtomicAction } from "@/lib/chillbros/job-parts";

import { createPartAction, updatePartAction } from "@/lib/chillbros/operations";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import { createServiceRoleClient } from "@/lib/supabase/service-client";

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

/**
 * Customer gave a verbal yes: publish the quote without emailing it, then
 * record the approval the same way a customer's portal approval does (the
 * work is sold; the final invoice is still issued after the work).
 */
export async function approveQuoteVerballyAction(jobId: string, lines: EstimateDraftLine[], notes: string, adjustments: EstimateAdjustments): Promise<Result<{ estimateId: string }>> {
  const profile = await getCurrentStaffProfile();
  if (profile?.role !== "manager") return { ok: false, error: "Only the owner can record a verbal approval." };
  const created = await createEstimateV2Action(jobId, lines, notes, adjustments, { sendToCustomer: false });
  if (!created.ok) return created;
  // Verbal approval is an authenticated owner action. Do not route it through
  // the public portal approval path, which can trigger auth/key verification.
  const supabase = createServiceRoleClient();
  const now = new Date().toISOString();
  const signature = `Verbal approval, taken by ${profile.fullName}`.slice(0, 200);
  const { data: approved, error: approvalError } = await supabase
    .from("chillbros_invoices")
    .update({ status: "approved", signature_name: signature, signed_at: now, issued_at: null, due_at: null, updated_at: now })
    .eq("id", created.data.estimateId)
    .eq("status", "awaiting_approval")
    .is("revoked_at", null)
    .select("id")
    .maybeSingle();
  if (approvalError || !approved) return { ok: false, error: `Quote saved, but verbal approval could not be recorded: ${approvalError?.message ?? "Approval update failed."}` };
  // Same as a signed approval: sold work goes to Unassigned unless the tech is still on site.
  await routeApprovedJob(supabase, jobId, now);
  await supabase.from("chillbros_workflow_events").insert({ job_id: jobId, invoice_id: created.data.estimateId, actor_id: profile.id, stage: "approved_needs_action", message: `Customer approved quote verbally. Recorded by ${profile.fullName}. Work is sold; proceed with work and issue the invoice when complete.` });
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/invoices");
  return { ok: true, data: { estimateId: created.data.estimateId } };
}

/**
 * A part bought online or locally (not normally stocked): adds it to the parts
 * list with its price, stocked at exactly the quantity used, then puts it on the job.
 */
export async function addCustomJobPartAction(input: { jobId: string; name: string; partNumber: string; cost: number; price: number; quantity: number }): Promise<Result> {
  const name = String(input.name ?? "").trim();
  const quantity = Math.floor(Number(input.quantity));
  const price = Number(input.price);
  const cost = Number(input.cost || 0);
  if (!name) return { ok: false, error: "Enter the part name." };
  if (!Number.isFinite(quantity) || quantity < 1 || quantity > 100) return { ok: false, error: "Quantity must be between 1 and 100." };
  if (!Number.isFinite(price) || price < 0) return { ok: false, error: "Enter the price you're charging." };
  const partNumber = String(input.partNumber ?? "").trim() || `CUSTOM-${Date.now().toString(36).toUpperCase()}`;

  const created = await createPartAction({ name, partNumber, defaultCost: cost, retailPrice: price, stock: quantity });
  const supabase = createServiceRoleClient();
  const { data: part } = await supabase.from("chillbros_parts_catalog").select("id,stock").eq("part_number", partNumber).maybeSingle();
  if (!created.ok) {
    // Same part number bought again: top up its stock and use today's price.
    if (!part || created.error !== "That part number already exists.") return created;
    const updated = await updatePartAction({ id: part.id, name, partNumber, defaultCost: cost, retailPrice: price, stock: Number(part.stock ?? 0) + quantity });
    if (!updated.ok) return updated;
  }
  if (!part) return { ok: false, error: "Part saved, but it could not be found to add to the job. Add it from the list." };

  const added = await addJobPartAtomicAction(input.jobId, part.id, quantity);
  if (!added.ok) return added;
  revalidatePath(`/jobs/${input.jobId}`);
  return { ok: true, data: undefined };
}
