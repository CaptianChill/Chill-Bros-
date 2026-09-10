import "server-only";

import { randomInt } from "node:crypto";

export type DocumentNumberKind = "estimate" | "quote" | "invoice" | "agreement";

const PREFIX: Record<DocumentNumberKind, string> = {
  estimate: "E",
  quote: "Q",
  invoice: "I",
  agreement: "A",
};

// This marker preserves the existing synchronous call sites. The database
// replaces it atomically with E-001 / Q-001 / I-001 / A-001 on insert.
export function simpleDocumentNumber(kind: DocumentNumberKind) {
  return `${PREFIX[kind]}-PENDING-${randomInt(100000, 1000000)}`;
}
