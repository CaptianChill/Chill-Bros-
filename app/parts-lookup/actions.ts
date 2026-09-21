"use server";
import { getCurrentStaffProfile } from "@/lib/supabase/auth-server";
import { researchParts, type PartsResearch } from "@/lib/chillbros/parts-research";
export type PartsLookupResult = { ok: true; data: PartsResearch } | { ok: false; error: string };
export async function lookupParts(formData: FormData): Promise<PartsLookupResult> {
  const profile = await getCurrentStaffProfile();
  if (!profile || !["manager", "technician", "office"].includes(profile.role)) return { ok: false, error: "Sign in to use parts lookup." };
  const read = (key: string, length: number) => String(formData.get(key) ?? "").trim().slice(0, length);
  const input = { brand: read("brand", 120), model: read("model", 120), serial: read("serial", 120), details: read("details", 1000), mode: read("mode", 20) === "manuals" ? "manuals" as const : "parts" as const };
  if (!input.brand || !input.model) return { ok: false, error: "Enter a brand and model number." };
  if (input.mode === "parts" && !input.details) return { ok: false, error: "Describe the part you need or the symptom, or choose Find parts manual." };
  try { return { ok: true, data: await researchParts(input) }; }
  catch (error) {
    return { ok: false, error: error instanceof Error && error.name === "TimeoutError" ? "Research took too long. Try the exact model and a shorter part description, or use the contact below." : "Web research is unavailable right now. Please retry, or use the contact below with your model and serial." };
  }
}
