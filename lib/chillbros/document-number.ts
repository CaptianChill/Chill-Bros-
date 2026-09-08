import "server-only";

import { randomInt } from "node:crypto";

export type DocumentNumberKind = "estimate" | "quote" | "invoice" | "agreement";

const PREFIX: Record<DocumentNumberKind, string> = {
  estimate: "E",
  quote: "Q",
  invoice: "I",
  agreement: "A",
};

export function simpleDocumentNumber(kind: DocumentNumberKind) {
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date()).replace(/-/g, "");
  return `${PREFIX[kind]}-${date}-${randomInt(1000, 10000)}`;
}
