export const categories = ["equipment_failure", "property_manager", "opening_remodel", "supplier_referral", "other"] as const;
export const serviceLines = ["hvac_r", "refrigeration", "ice_machine", "kitchen_equipment", "exhaust_hood", "multiple"] as const;
export const statuses = ["new", "research", "approved", "skipped", "contacted", "quoted", "won", "lost"] as const;

export function normalizedKey(name: string, city: string, category: string, sourceUrl: string) {
  const clean = (value: string) => value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").trim();
  return [clean(name), clean(city), category, sourceUrl.toLowerCase().replace(/\/$/, "")].join("|");
}

export function scoreSignal(category: string, observedAt: string, verified: boolean) {
  const base: Record<string, number> = { equipment_failure: 72, property_manager: 65, opening_remodel: 61, supplier_referral: 59, other: 35 };
  const ageDays = Math.max(0, (Date.now() - new Date(observedAt).getTime()) / 86400000);
  const agePenalty = ageDays > 30 ? 30 : ageDays > 7 ? 15 : ageDays > 2 ? 7 : 0;
  return Math.max(0, Math.min(100, (base[category] ?? 35) + (verified ? 12 : 0) - agePenalty));
}
