// Picks a business contact email out of a company's own web pages. Pure (no imports).

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,24}/gi;
const JUNK_LOCAL = /^(no-?reply|donotreply|do-not-reply|postmaster|abuse|webmaster|privacy|legal|dmca|example|test|user|name|email|your|you|someone)$/i;
const JUNK_DOMAIN = /(sentry|wixpress|example\.|domain\.com|email\.com|yourdomain|godaddy|squarespace|wordpress|cloudflare|schema\.org|w3\.org|googleapis|gstatic|jquery|bootstrap)/i;
const FREE_MAIL = /^(gmail|yahoo|outlook|hotmail|aol|icloud|live|msn|att|sbcglobal|me)\.(com|net)$/i;
const FILE_TLD = /\.(png|jpe?g|gif|svg|webp|ico|css|js|woff2?|ttf|pdf)$/i;
const PREFERRED_LOCAL = ["info", "contact", "office", "hello", "service", "manager", "admin", "sales", "events", "catering", "reservations", "owner"];

export function websiteFromSummary(summary: string | null | undefined) {
  const m = /Website: (\S+?)\.?(?:\s|$)/.exec(String(summary ?? ""));
  if (!m) return null;
  let url = m[1].trim();
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  try {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol)) return null;
    return u.toString();
  } catch {
    return null;
  }
}

function registrable(host: string) {
  return host.toLowerCase().replace(/^www\./, "").split(".").slice(-2).join(".");
}

/** Best contact email from page HTML, preferring the site's own domain and role inboxes. */
export function pickBusinessEmail(html: string, siteUrl: string): string | null {
  const host = (() => { try { return registrable(new URL(siteUrl).hostname); } catch { return ""; } })();
  const decoded = String(html).replace(/\s*(?:\[at\]|\(at\))\s*/gi, "@").replace(/&#64;|&commat;/gi, "@").replace(/%40/g, "@");
  const found = new Set<string>();
  for (const raw of decoded.match(EMAIL_RE) ?? []) {
    const email = raw.toLowerCase().replace(/^mailto:/, "").replace(/[.,;:]+$/, "");
    const [local, domain] = email.split("@");
    if (!local || !domain) continue;
    if (JUNK_LOCAL.test(local) || JUNK_DOMAIN.test(domain) || FILE_TLD.test(email)) continue;
    if (/^[0-9a-f]{16,}$/.test(local)) continue; // tracking hashes
    found.add(email);
  }
  // Off-domain addresses (web designers, font credits, vendors) are only trusted when
  // the page links them as a mailto: contact; the site's own domain and free mail always count.
  const mailto = new Set((String(html).match(/mailto:([^"'?>\s]+)/gi) ?? []).map((m) => decodeURIComponent(m.slice(7)).toLowerCase()));
  for (const email of [...found]) {
    const domain = email.split("@")[1];
    const own = host && registrable(domain) === host;
    const free = FREE_MAIL.test(domain);
    if (!own && !free && !mailto.has(email)) found.delete(email);
  }
  if (!found.size) return null;
  const score = (email: string) => {
    const [local, domain] = email.split("@");
    let s = 0;
    if (host && registrable(domain) === host) s += 10;
    const pref = PREFERRED_LOCAL.indexOf(local);
    if (pref >= 0) s += 5 - pref * 0.1;
    if (FREE_MAIL.test(domain)) s += 1; // small businesses often use these
    return s;
  };
  return [...found].sort((a, b) => score(b) - score(a))[0];
}
