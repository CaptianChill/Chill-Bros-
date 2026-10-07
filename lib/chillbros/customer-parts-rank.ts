// Pure helpers shared by the server query and the client parts pickers.

export type PartUse = { customerId: string | null; partId: string | null; quantity: number };

/** customerId -> part ids that customer has used, most-used first. */
export function rankCustomerParts(uses: PartUse[]): Record<string, string[]> {
  const counts = new Map<string, Map<string, number>>();
  for (const use of uses) {
    if (!use.customerId || !use.partId) continue;
    const byPart = counts.get(use.customerId) ?? new Map<string, number>();
    byPart.set(use.partId, (byPart.get(use.partId) ?? 0) + Math.max(1, use.quantity || 1));
    counts.set(use.customerId, byPart);
  }
  const result: Record<string, string[]> = {};
  for (const [customerId, byPart] of counts) result[customerId] = [...byPart.entries()].sort((a, b) => b[1] - a[1]).map(([partId]) => partId);
  return result;
}

/** Split a parts list into this customer's parts (in their usage order) and everything else. */
export function splitCustomerParts<T extends { id: string }>(parts: T[], customerPartIds: string[] | undefined) {
  if (!customerPartIds?.length) return { mine: [] as T[], rest: parts };
  const byId = new Map(parts.map((part) => [part.id, part]));
  const mine = customerPartIds.map((id) => byId.get(id)).filter((part): part is T => Boolean(part));
  const mineIds = new Set(mine.map((part) => part.id));
  return { mine, rest: parts.filter((part) => !mineIds.has(part.id)) };
}
