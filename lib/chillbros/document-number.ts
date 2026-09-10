import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service-client";

export type DocumentNumberKind = "estimate" | "quote" | "invoice" | "agreement";

export async function simpleDocumentNumber(kind: DocumentNumberKind) {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.rpc("chillbros_next_document_number", { p_kind: kind });
  if (error || !data) throw new Error(error?.message ?? "Could not generate document number.");
  return String(data);
}
