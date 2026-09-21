import "server-only";

export type PartsDepartmentContact = { brand: string; phone: string; note?: string };

/**
 * Verified against each manufacturer's own contact/support page on 2026-09-21.
 * These numbers can change — treat them as a fast starting point for a call,
 * not a guarantee. Only real, checked numbers belong here; never let this
 * list grow from a guess.
 */
const CONTACTS: Record<string, PartsDepartmentContact> = {
  carrier: { brand: "Carrier", phone: "1-800-227-7437" },
  trane: { brand: "Trane", phone: "1-800-945-5884" },
  rheem: { brand: "Rheem", phone: "1-800-432-8373" },
  ruud: { brand: "Rheem (Ruud)", phone: "1-800-432-8373" },
  goodman: { brand: "Goodman", phone: "1-877-254-4729" },
  amana: { brand: "Amana (Goodman Global)", phone: "1-877-254-4729" },
  lennox: { brand: "Lennox", phone: "1-800-953-6669" },
  york: { brand: "York (Johnson Controls)", phone: "1-877-874-7378" },
  "johnson controls": { brand: "York (Johnson Controls)", phone: "1-877-874-7378" },
  "mitsubishi electric": { brand: "Mitsubishi Electric Trane HVAC US", phone: "1-800-433-4822" },
  mitsubishi: { brand: "Mitsubishi Electric Trane HVAC US", phone: "1-800-433-4822" },
  daikin: { brand: "Daikin Comfort (residential / light commercial)", phone: "1-866-588-6454", note: "Daikin Applied (commercial/industrial): 1-800-432-1342" },
  true: { brand: "True Manufacturing (parts)", phone: "1-800-424-8783" },
  "true manufacturing": { brand: "True Manufacturing (parts)", phone: "1-800-424-8783" },
  hoshizaki: { brand: "Hoshizaki America", phone: "1-800-233-1940" },
  traulsen: { brand: "Traulsen", phone: "1-800-825-8220" },
  "beverage-air": { brand: "Beverage-Air", phone: "1-888-845-9800" },
  "beverage air": { brand: "Beverage-Air", phone: "1-888-845-9800" },
  manitowoc: { brand: "Manitowoc Ice (parts)", phone: "1-800-545-5720" },
  scotsman: { brand: "Scotsman Ice Systems", phone: "1-800-726-8762" },
  hobart: { brand: "Hobart (service & parts)", phone: "1-888-446-2278" },
};

export function lookupPartsDepartmentContact(brandInput: string): PartsDepartmentContact | null {
  const key = brandInput.trim().toLowerCase();
  if (!key) return null;
  if (CONTACTS[key]) return CONTACTS[key];
  for (const [alias, contact] of Object.entries(CONTACTS)) {
    if (key.includes(alias) || alias.includes(key)) return contact;
  }
  return null;
}
