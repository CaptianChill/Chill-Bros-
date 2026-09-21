import "server-only";

import { gateway, generateObject, jsonSchema } from "ai";

const FIELD_NOTES_MODEL = "openai/gpt-5.6-terra";

export type FieldNoteAiResult = {
  rawTranscription: string;
  customerComplaint: string | null;
  diagnosis: string | null;
  workPerformed: string | null;
  materials: { description: string; quantity: string; partNumber: string | null; confidence: "high" | "low" }[];
  laborHours: number | null;
  driveHours: number | null;
  equipmentStatus: string | null;
  recommendations: string | null;
  followUpRequired: boolean;
  cleanedInternalNotes: string;
  customerSummary: string;
  confidenceFlags: { field: string; value: string; reason: string }[];
};

const RESULT_SCHEMA = jsonSchema<FieldNoteAiResult>({
  type: "object",
  additionalProperties: false,
  properties: {
    rawTranscription: {
      type: "string",
      description: "Best-effort verbatim transcription of the handwritten note(s), in reading order across all pages.",
    },
    customerComplaint: { type: ["string", "null"], description: "What the customer reported or why the call was made." },
    diagnosis: { type: ["string", "null"], description: "What the technician found to be wrong." },
    workPerformed: { type: ["string", "null"], description: "What repair/service work was actually completed." },
    materials: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          description: { type: "string" },
          quantity: { type: "string" },
          partNumber: { type: ["string", "null"] },
          confidence: { type: "string", enum: ["high", "low"] },
        },
        required: ["description", "quantity", "partNumber", "confidence"],
      },
    },
    laborHours: { type: ["number", "null"] },
    driveHours: { type: ["number", "null"] },
    equipmentStatus: { type: ["string", "null"], description: "Operational status of the equipment after the visit." },
    recommendations: { type: ["string", "null"] },
    followUpRequired: { type: "boolean" },
    cleanedInternalNotes: {
      type: "string",
      description: "Professional internal service record: complaint, diagnosis, work performed, materials, equipment status, recommendations. Internal-only technician observations may stay here.",
    },
    customerSummary: {
      type: "string",
      description: "Professional customer-facing summary of complaint, findings, work performed, materials, equipment status, and recommendations. Never includes internal-only commentary (e.g. about the customer's payment behavior); reframe such notes around authorization/scope status instead.",
    },
    confidenceFlags: {
      type: "array",
      description: "One entry per critical technical value that was illegible, ambiguous, or inferred rather than clearly written.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          field: { type: "string", description: "Name of the uncertain field, e.g. 'refrigerant_type' or 'model_number'." },
          value: { type: "string", description: "The best-interpretation value that was still recorded." },
          reason: { type: "string", description: "Why this value is uncertain." },
        },
        required: ["field", "value", "reason"],
      },
    },
  },
  required: [
    "rawTranscription",
    "customerComplaint",
    "diagnosis",
    "workPerformed",
    "materials",
    "laborHours",
    "driveHours",
    "equipmentStatus",
    "recommendations",
    "followUpRequired",
    "cleanedInternalNotes",
    "customerSummary",
    "confidenceFlags",
  ],
});

const SYSTEM_PROMPT = `
You are the Chill Pros Field Notes AI. You convert a technician's handwritten HVAC/R service notes (photographed, possibly multiple pages) into a structured service record for office review.

CRITICAL SAFETY RULES:
- Never silently invent or guess a precise technical value. For model numbers, serial numbers, part numbers, refrigerant type, refrigerant quantity, voltage, amperage, pressures, temperatures, labor hours, drive hours, or equipment identification: if the handwriting is unclear, ambiguous, inconsistent, or missing, still record your best interpretation in the field, AND add an entry to confidenceFlags naming that field, the value you recorded, and why it is uncertain (e.g. "24V vs 240V unclear", "could be R-134a or R-410A", "digit smudged, could be 1.5 lb or 15 lb").
- Do not average or split the difference between two plausible readings. Pick the more likely one, record it, and flag it.
- If a field is not mentioned in the notes at all, leave it null (or empty array) rather than fabricating content.

INTERNAL VS CUSTOMER OUTPUT:
- cleanedInternalNotes is for office/technician eyes: a clear, professional write-up of the complaint, diagnosis, work performed, materials, equipment status, and recommendations. Internal-only technician remarks (e.g. about a difficult customer, unpaid balances, safety concerns about the property) may be preserved here in neutral professional language.
- customerSummary is what a customer may see: professional, factual, and courteous. It must NEVER include commentary about the customer's behavior, payment history, or anything unprofessional. If the technician noted unresolved/unauthorized work (e.g. "customer refused repair" or "owner avoiding payment"), rephrase it neutrally around scope/authorization, e.g. "Additional repairs were identified and were not completed during this visit. Further authorization is required before repairs proceed."

Read every page image provided, in the order given, as one continuous note. Transcribe handwriting as literally as you can into rawTranscription before structuring the rest.
`.trim();

export async function processFieldNoteImages(input: {
  imageUrls: string[];
  technicianNote: string | null;
  customerName: string | null;
  equipmentContext: string | null;
}): Promise<{ ok: true; data: FieldNoteAiResult; model: string } | { ok: false; error: string }> {
  if (input.imageUrls.length === 0) return { ok: false, error: "No images to process." };

  const contextLines = [
    input.customerName ? `Customer: ${input.customerName}` : null,
    input.equipmentContext ? `Known equipment on file: ${input.equipmentContext}` : null,
    input.technicianNote ? `Technician's typed note: ${input.technicianNote}` : null,
  ].filter(Boolean).join("\n");

  try {
    const result = await generateObject({
      model: gateway(FIELD_NOTES_MODEL),
      schema: RESULT_SCHEMA,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: contextLines || "No additional context provided." },
            ...input.imageUrls.map((url) => ({ type: "image" as const, image: url })),
          ],
        },
      ],
      maxOutputTokens: 10000,
      abortSignal: AbortSignal.timeout(180000),
    });

    return { ok: true, data: result.object, model: FIELD_NOTES_MODEL };
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI processing failed.";
    return { ok: false, error: message };
  }
}
