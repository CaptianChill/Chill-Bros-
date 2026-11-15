import { BASE, SA_BOX, PROFILES } from "./_profiles.js";

const OVERPASS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];
const UA = "LeadEngine/1.0 (San Antonio local business research; read-only)";
const SOCIAL = /(facebook\.com|fb\.com|instagram\.com|yelp\.com|linktr\.ee|tiktok\.com|google\.com\/maps|business\.site|maps\.app\.goo\.gl|nextdoor\.com|mapquest\.com)/i;
const BUILDERS = [["wix", /wix(static)?\.com|_wixCssImports|X-Wix/i], ["Squarespace", /squarespace/i], ["GoDaddy builder", /godaddy|img1\.wsimg\.com|websites\.godaddy/i], ["Weebly", /weebly/i], ["Site123", /site123/i], ["Yola", /yola(cdn)?\.com/i], ["Jimdo", /jimdo/i], ["Webs", /webs\.com/i], ["Duda", /dudaone|multiscreensite/i]];

export const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)));

export function km(a, b) {
  const R = 6371, t = Math.PI / 180;
  const dLat = (b.lat - a.lat) * t, dLon = (b.lon - a.lon) * t;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * t) * Math.cos(b.lat * t) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

async function overpassBox(profile, box, deadline, offset = 0) {
  const b = `${box.south},${box.west},${box.north},${box.east}`;
  const query = `[out:json][timeout:40];(${profile.overpass(b)});out tags center 4000;`;
  const budget = Math.max(5000, deadline - Date.now() - 10000);
  // Race every mirror at once and take the first complete answer: public servers are often overloaded.
  const ctrl = new AbortController();
  const tries = OVERPASS.map((url) => (async () => {
    const r = await fetch(url, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": UA, accept: "application/json" }, body: new URLSearchParams({ data: query }), signal: AbortSignal.any([ctrl.signal, AbortSignal.timeout(budget)]) });
    if (!r.ok) throw new Error(`${new URL(url).hostname} ${r.status}`);
    const j = await r.json();
    if (!Array.isArray(j.elements) || j.remark) throw new Error(`${new URL(url).hostname} partial`);
    return { elements: j.elements, source: new URL(url).hostname };
  })().catch((e) => { throw new Error(e.message.includes(".") ? e.message : `${new URL(url).hostname} ${e.name}`); }));
  try { const win = await Promise.any(tries); ctrl.abort(); return win; }
  catch (e) { throw new Error((e.errors ?? [e]).map((x) => x.message).join("; ")); }
}

// Splits the metro box into n x n tiles so heavy categories (restaurants) don't overload the free map servers.
export async function overpass(profile, deadline) {
  const n = profile.tiles ?? 1;
  const tiles = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const dLat = (SA_BOX.north - SA_BOX.south) / n, dLon = (SA_BOX.east - SA_BOX.west) / n;
    tiles.push({ south: SA_BOX.south + i * dLat, north: SA_BOX.south + (i + 1) * dLat, west: SA_BOX.west + j * dLon, east: SA_BOX.west + (j + 1) * dLon });
  }
  const results = await pool(tiles, 3, (t, k) => overpassBox(profile, t, deadline, k).catch((e) => ({ error: e.message })));
  const ok = results.filter((r) => r.elements);
  if (!ok.length) throw new Error(`Map source unavailable: ${results.map((r) => r.error).join(" | ")}`);
  return { elements: ok.flatMap((r) => r.elements), source: [...new Set(ok.map((r) => r.source))].join(", "), tilesOk: ok.length, tiles: tiles.length };
}

const pick = (t, ...keys) => { for (const k of keys) if (t[k]) return t[k]; return null; };

export function normalize(el) {
  const t = el.tags ?? {};
  const name = (t.name ?? "").trim();
  const lat = el.lat ?? el.center?.lat, lon = el.lon ?? el.center?.lon;
  let website = pick(t, "website", "contact:website", "url");
  const facebook = pick(t, "contact:facebook", "facebook");
  const instagram = pick(t, "contact:instagram", "instagram");
  if (website && !/^https?:\/\//i.test(website)) website = `http://${website}`;
  const street = [t["addr:housenumber"], t["addr:street"]].filter(Boolean).join(" ");
  const address = [street, t["addr:city"], t["addr:postcode"]].filter(Boolean).join(", ") || null;
  return {
    id: `${el.type}/${el.id}`, name, lat, lon, tags: t, address,
    phone: pick(t, "phone", "contact:phone", "contact:mobile"), email: pick(t, "email", "contact:email"),
    website, facebook, instagram, hours: t.opening_hours ?? null, brand: t.brand ?? t["brand:wikidata"] ?? null,
    osm: `https://www.openstreetmap.org/${el.type}/${el.id}`,
  };
}

// ---------------------------------------------------------------- website audit
export function auditHtml(html, finalUrl, ms) {
  const yearMatches = [...html.matchAll(/(?:©|&copy;|copyright)\s*(?:\d{4}\s*[-–]\s*)?(\d{4})/gi)].map((m) => Number(m[1])).filter((y) => y > 1995 && y < 2100);
  const lower = html.toLowerCase();
  const builder = BUILDERS.find(([, re]) => re.test(html))?.[0] ?? null;
  return {
    checked: true, ok: true, https: finalUrl.startsWith("https://"), finalUrl,
    mobile: /<meta[^>]+name=["']?viewport/i.test(html),
    copyrightYear: yearMatches.length ? Math.max(...yearMatches) : null,
    builder,
    leadCapture: /<form[\s>]/i.test(html) && /(quote|estimate|appointment|book|schedule|contact|request|message)/i.test(lower) || /(calendly|booksy|square\.site\/book|setmore|shopmonkey|tekmetric|autoleap|mechanicadvisor|getjobber|housecall|book now|book online|schedule service|request a quote)/i.test(lower),
    onlineOrdering: /(order online|order now|toasttab|clover\.com|doordash|ubereats|grubhub|chownow|square\.site|olo\.com|popmenu|bentobox)/i.test(lower),
    catering: /catering/i.test(lower),
    multiLocation: /(our locations|all locations|find a location|choose (a|your) location|\blocations\b<\/a>)/i.test(lower),
    email: (html.match(/mailto:([^"'?>\s]+)/i) ?? [])[1] ?? null,
    phoneOnSite: /tel:/i.test(html),
    title: (html.match(/<title[^>]*>([^<]{0,120})/i) ?? [])[1]?.trim() ?? null,
    slowMs: ms,
  };
}

export async function auditWebsite(url, timeoutMs = 8000) {
  if (!url) return { listed: false, checked: false };
  const social = url.match(SOCIAL);
  if (social) return { listed: true, checked: false, socialOnly: social[1].split(".")[0] };
  const started = Date.now();
  try {
    const r = await fetch(url, { redirect: "follow", headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36", accept: "text/html" }, signal: AbortSignal.timeout(timeoutMs) });
    const ms = Date.now() - started;
    if (!r.ok) return { listed: true, checked: true, ok: false, status: r.status };
    const html = (await r.text()).slice(0, 400000);
    if (html.length < 400 || /domain (is )?for sale|parked|this domain|account suspended|coming soon/i.test(html.slice(0, 5000))) return { listed: true, checked: true, ok: false, status: "parked/empty" };
    return { listed: true, ...auditHtml(html, r.url || url, ms) };
  } catch (e) {
    return { listed: true, checked: true, ok: false, error: e.name === "TimeoutError" ? "timed out" : (e.cause?.code ?? e.name) };
  }
}

// ---------------------------------------------------------------- shared factors
function hoursProfile(hours) {
  if (!hours) return { score: 50, note: "hours unknown" };
  if (/24\/7/.test(hours)) return { score: 100, note: "open 24/7" };
  const closes = [...hours.matchAll(/-(\d{2}):(\d{2})/g)].map((m) => Number(m[1]) + Number(m[2]) / 60);
  const opens = [...hours.matchAll(/(\d{2}):(\d{2})-/g)].map((m) => Number(m[1]));
  const late = closes.some((c) => c >= 23 || c <= 4);
  const early = opens.some((o) => o <= 7);
  const sunday = /Su/.test(hours) && !/Su off/i.test(hours);
  let score = 55; const notes = [];
  if (late) { score += 25; notes.push("open late"); }
  if (early) { score += 10; notes.push("opens early"); }
  if (sunday) { score += 10; notes.push("open 7 days"); }
  return { score: clamp(score), note: notes.join(", ") || "standard hours" };
}

function reachScore(lead, web) {
  let s = 0; const n = [];
  if (lead.phone) { s += 60; n.push("phone"); }
  if (lead.email || web.email) { s += 25; n.push("email"); }
  if (web.ok || web.socialOnly || lead.facebook || lead.instagram) { s += 15; n.push(web.ok ? "website" : "social page"); }
  if (!s && lead.address) { s = 25; n.push("address only (walk-in)"); }
  return { score: clamp(s), note: n.join(" + ") || "no contact info" };
}

function establishedScore(lead) {
  // A complete, well-maintained map listing signals a real, active business.
  let s = 30;
  if (lead.address) s += 20;
  if (lead.hours) s += 20;
  if (lead.phone) s += 15;
  if (Object.keys(lead.tags).length >= 8) s += 15;
  return clamp(s);
}

function proximityScore(lead) {
  if (lead.lat == null) return { score: 50, km: null };
  const d = km(BASE, lead);
  return { score: clamp(d <= 8 ? 100 : 100 - ((d - 8) / 32) * 80), km: Math.round(d * 10) / 10 };
}

const grade = (s) => (s >= 80 ? "A" : s >= 68 ? "B" : s >= 55 ? "C" : "D");

// ---------------------------------------------------------------- score one lead
export function scoreLead(profile, lead, web) {
  const sub = profile.subtype(lead.tags, lead.name);
  const chain = Boolean(lead.brand) || profile.chainRegex.test(lead.name);
  const never = profile.neverRegex?.test(lead.name) ?? false;
  const prox = proximityScore(lead);
  const reach = reachScore(lead, web);
  const f = {}; const why = [];

  if (profile.id === "auto_web") {
    const need = profile.need(web);
    f.need = need.score; f.value = sub.value; f.independence = chain ? 0 : 100;
    f.reach = reach.score; f.established = establishedScore(lead); f.proximity = prox.score;
    why.push(...need.notes, sub.kind, `reach: ${reach.note}`);
  } else {
    const hrs = hoursProfile(lead.hours);
    f.load = sub.value; f.independence = never ? 0 : chain ? 15 : web.multiLocation ? 60 : 100;
    f.runtime = hrs.score; f.proximity = prox.score; f.reach = reach.score;
    let size = 50;
    if (web.catering) size += 20; if (web.multiLocation) size += 5; if (web.onlineOrdering) size += 10;
    if (lead.tags.drive_through === "yes") size += 10;
    f.size = clamp(size);
    why.push(sub.kind, hrs.note, prox.km != null ? `${prox.km} km from base` : "location unknown", `reach: ${reach.note}`);
    if (web.catering) why.push("does catering (bigger kitchen)");
    if (web.multiLocation && !chain) why.push("multi-location group: ask for the owner or facilities manager (one contract can cover several sites)");
    if (chain) why.push("chain/franchise: vendor may be set by corporate");
  }

  const score = clamp(Object.entries(profile.weights).reduce((sum, [k, w]) => sum + (f[k] ?? 0) * w, 0));
  const excluded = never || (profile.excludeChains && chain);
  return {
    rank: 0, score, grade: grade(score), name: lead.name, type: sub.kind,
    pitch: buildPitch(profile, lead, sub, web),
    why: why.filter(Boolean).join("; "), equipment: sub.equipment ?? null,
    phone: lead.phone, email: [lead.email, web.email].find((e) => e && /^[^\s@${}]+@[^\s@]+\.[a-z]{2,}$/i.test(e)) ?? null, website: lead.website, facebook: lead.facebook, instagram: lead.instagram,
    address: lead.address, hours: lead.hours, km_from_base: prox.km, chain, excluded,
    factors: f, map: lead.osm, lat: lead.lat, lon: lead.lon,
  };
}

function buildPitch(profile, lead, sub, web) {
  if (profile.id === "auto_web") {
    const hook = !web.listed ? "You don't have a website, so Google sends 'near me' searches to shops that do."
      : web.socialOnly ? `Your only site is a ${web.socialOnly} page; customers searching Google can't get a quote.`
      : web.checked && !web.ok && web.error !== "timed out" ? "Your website isn't loading right now; anyone who clicks it bounces to a competitor."
      : web.checked && !web.mobile ? "Your site doesn't fit a phone screen, and most car owners search from their phone."
      : web.checked && !web.leadCapture ? "Your site has no quote or booking form, so visitors have to call during business hours or leave."
      : "Your site works but isn't capturing leads 24/7.";
    return `${hook} ${sub.angle[0].toUpperCase()}${sub.angle.slice(1)}. Show V Performance as the example.`;
  }
  return `${sub.angle[0].toUpperCase()}${sub.angle.slice(1)}. Equipment to ask about: ${sub.equipment}.`;
}

// ---------------------------------------------------------------- full run
async function pool(items, size, fn) {
  const out = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: size }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); } }));
  return out;
}

export async function runScan({ profileId, limit = 50, enrich = 80, budgetMs = 100000, includeChains = false }) {
  const profile = PROFILES[profileId];
  if (!profile) throw new Error(`Unknown profile ${profileId}`);
  const deadline = Date.now() + budgetMs;
  const { elements, source, tilesOk, tiles } = await overpass(profile, deadline);

  // De-duplicate (same name within ~150 m) and drop unnamed.
  const seen = new Map();
  for (const el of elements) {
    const lead = normalize(el);
    if (!lead.name || lead.lat == null) continue;
    const key = lead.name.toLowerCase().replace(/[^a-z0-9]/g, "");
    const prev = seen.get(key);
    if (prev && km(prev, lead) < 0.15) { if (Object.keys(lead.tags).length > Object.keys(prev.tags).length) seen.set(key, lead); continue; }
    seen.set(prev ? `${key}@${lead.id}` : key, lead);
  }
  const leads = [...seen.values()];

  // Pass 1: score on map data alone (assume the worst-case web need for unaudited sites).
  const prelim = leads.map((l) => ({ lead: l, s: scoreLead(profile, l, l.website ? { listed: true, checked: false, socialOnly: (l.website.match(SOCIAL) ?? [])[1]?.split(".")[0] } : { listed: false, checked: false }) }))
    .filter((x) => includeChains || !x.s.excluded)
    .sort((a, b) => b.s.score - a.s.score);

  // Pass 2: audit websites of the strongest candidates, then re-score.
  const top = prelim.slice(0, enrich);
  const timePer = Math.max(3000, Math.min(6000, deadline - Date.now() - 4000));
  const rescored = await pool(top, 24, async ({ lead }) => scoreLead(profile, lead, Date.now() < deadline - 4000 ? await auditWebsite(lead.website, timePer) : { listed: Boolean(lead.website), checked: false }));
  const rest = prelim.slice(enrich).map((x) => x.s);
  const ranked = [...rescored, ...rest].sort((a, b) => b.score - a.score).slice(0, limit).map((r, i) => ({ ...r, rank: i + 1 }));
  return {
    profile: { id: profile.id, label: profile.label, offer: profile.offer, weights: profile.weights },
    found: elements.length, coverage: tiles ? `${tilesOk}/${tiles} map tiles` : "full", unique: leads.length, eligible: prelim.length, audited: top.length, source,
    generatedAt: new Date().toISOString(), leads: ranked,
  };
}

export function toCsv(result) {
  const cols = ["rank", "score", "grade", "name", "type", "phone", "email", "website", "address", "km_from_base", "hours", "pitch", "why", "equipment", "map"];
  const esc = (v) => (v == null ? "" : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  return [cols.join(","), ...result.leads.map((l) => cols.map((c) => esc(l[c])).join(","))].join("\n");
}
