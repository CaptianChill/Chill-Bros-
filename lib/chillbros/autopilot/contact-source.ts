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

// Follow published contact links on the business's own origin, including custom paths.
export function contactPageUrls(html: string, site: string) {
  const base = new URL(site);
  const urls = new Set<string>();
  for (const match of html.matchAll(/href=["']([^"']+)["']/gi)) {
    try {
      const url = new URL(match[1].replace(/&amp;/g, "&"), base);
      if (url.origin !== base.origin || !/contact|about/i.test(url.pathname)) continue;
      url.hash = "";
      urls.add(url.toString());
    } catch { /* Ignore malformed links from public HTML. */ }
  }
  for (const path of ["/contact", "/contact-us"]) urls.add(new URL(path, base).toString());
  return [...urls].slice(0, 3);
}
