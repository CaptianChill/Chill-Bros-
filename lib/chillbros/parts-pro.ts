/** Link to Parts Pro (the AI parts lookup), prefilled and with a way back. */
export function partsProHref(input: { details?: string | null; brand?: string | null; model?: string | null; serial?: string | null; back?: string }) {
  const query = new URLSearchParams();
  for (const key of ["brand", "model", "serial", "details", "back"] as const) {
    const value = input[key]?.trim();
    if (value) query.set(key, key === "details" ? value.slice(0, 300) : value);
  }
  return `/parts-lookup${query.size ? `?${query.toString()}` : ""}`;
}
