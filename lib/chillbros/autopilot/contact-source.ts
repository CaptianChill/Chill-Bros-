// Only exact source identifiers are refreshed; never guess a business contact.
export function osmIdentity(source: string | null) {
  const match = /^https:\/\/www\.openstreetmap\.org\/(node|way|relation)\/(\d+)\/?$/.exec(source ?? "");
  return match ? { type: match[1], id: match[2] } : null;
}

export function phoneFromHtml(html: string) {
  const raw = /href=["']tel:([^"']+)/i.exec(html)?.[1];
  if (!raw) return null;
  const phone = raw.replace(/[^\d+]/g, "");
  return /^\+?1?\d{10}$/.test(phone) ? phone : null;
}
