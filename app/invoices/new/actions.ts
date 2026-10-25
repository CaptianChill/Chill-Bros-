"use server";

import { redirect } from "next/navigation";

import { createDirectDocument, DirectDocumentError, type DirectDocumentResult } from "@/lib/chillbros/direct-document-core";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";

type DocumentType = "quote" | "invoice";
function fail(message: string, type: DocumentType): never { redirect(`/invoices/new?type=${type}&error=${encodeURIComponent(message)}&t=${Date.now()}`); }

export async function createDirectInvoiceAction(formData: FormData): Promise<never> {
  const profile = await getCurrentStaffProfile();
  if (!profile || !["manager", "office"].includes(profile.role)) redirect("/sign-in");
  const type: DocumentType = String(formData.get("documentType") ?? "").trim() === "quote" ? "quote" : "invoice";
  let result: DirectDocumentResult;
  try {
    result = await createDirectDocument(formData, profile);
  } catch (error) {
    if (error instanceof DirectDocumentError) fail(error.message, type);
    throw error;
  }
  if (result.sent) {
    const label = result.type === "quote" ? "Quote" : "Invoice";
    const sendNote = result.sent.ok
      ? `&sent=${result.sent.channel}&success=${encodeURIComponent(`${label} ${result.number} ${result.sent.channel === "email" ? "emailed" : "texted"} to ${result.sent.recipient ?? "the customer"}.`)}`
      : `&error=${encodeURIComponent(`Saved, but not sent: ${result.sent.error}`)}`;
    redirect(`/invoices?focus=${encodeURIComponent(result.id)}&created=1${sendNote}`);
  }
  redirect(`/invoices?focus=${encodeURIComponent(result.id)}&created=1`);
}
