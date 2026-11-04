// Pure rules for Sales Prep (no I/O, tested in scripts/sales-prep.test.cjs).
// A lead is "sales ready" when it has a current battle card (call script, questions,
// objections, plan tier) and at least one way to reach the business.

export type PrepLead = {
  contact_phone?: string | null;
  contact_email?: string | null;
  sales_status?: string | null;
  do_not_contact?: boolean | null;
};

export const PREP_CLOSED_STATUSES = ["won", "lost", "do_not_contact"] as const;

export function hasContact(lead: PrepLead) {
  return Boolean(String(lead.contact_phone ?? "").trim() || String(lead.contact_email ?? "").trim());
}

// Only fresh leads move to ready_to_call; anything a person already worked keeps its status.
export function nextSalesStatus(lead: PrepLead): string | null {
  if (lead.do_not_contact) return null;
  const status = lead.sales_status ?? "new";
  if (status !== "new") return null;
  return hasContact(lead) ? "ready_to_call" : null;
}

// Reachable leads get the AI-written card; leads with no phone or email get the free
// standard card now and are re-prepped with AI once contact info turns up.
export function wantsAiCard(lead: PrepLead) {
  return hasContact(lead) && !lead.do_not_contact;
}

// Search text for a Places lookup: name plus the most specific location known.
export function placesQuery(name: string, address: string | null | undefined, city: string | null | undefined) {
  const where = String(address || "").trim() || `${String(city || "San Antonio").trim()}, TX`;
  return `${name.trim()} ${where}`.replace(/\s+/g, " ").slice(0, 200);
}

const norm = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").trim();

// Guard against Places returning a different business: most of the name's words must match.
export function sameBusiness(ourName: string, theirName: string) {
  const ours = norm(ourName).split(" ").filter((w) => w.length > 2 && !["the", "and", "inc", "llc", "san", "antonio"].includes(w));
  const theirs = new Set(norm(theirName).split(" "));
  if (!ours.length) return norm(ourName) === norm(theirName);
  const hits = ours.filter((w) => theirs.has(w)).length;
  return hits / ours.length >= 0.6;
}
