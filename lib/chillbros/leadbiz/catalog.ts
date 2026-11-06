// Lead packs v2 lineup. Mirrors table chillbros_leadpack_products (migration
// 20261106120000_leadpack_ledger.sql); the database is what enforces counts and caps.
// Pure module (no I/O) so pages, emails and tests share one source of truth.
import type { Trade } from "../trade-fit";

export const MAX_BUYERS_PER_TRADE = 3;

/** URL slug used in ?trade=, the ledger and delivery links. */
export const TRADE_SLUG: Record<Trade, string> = {
  plumbing: "plumbers",
  electrical: "electricians",
  hood_cleaning: "hood-cleaners",
  pest_control: "pest-control",
  commercial_cleaning: "commercial-cleaning",
  signs: "signs",
  low_voltage: "low-voltage",
  security: "security",
  hvac_refrigeration: "hvac-refrigeration",
  kitchen_equipment: "kitchen-equipment",
};
export const SLUG_TRADE = Object.fromEntries(Object.entries(TRADE_SLUG).map(([t, s]) => [s, t])) as Record<string, Trade>;
export const isTradeSlug = (s: unknown): s is string => typeof s === "string" && s in SLUG_TRADE;

export type ProductKey = "starter" | "trade" | "growth" | "pro" | "local" | "pro_plan";
export type Product = {
  key: ProductKey; name: string; kind: "pack" | "subscription"; price: number; projects: number; contacts: number;
  best?: boolean; points: string[];
};

export const PACKS: Product[] = [
  { key: "starter", name: "Starter Pack", kind: "pack", price: 89, projects: 5, contacts: 0,
    points: ["5 verified new openings & remodels", "Owner or tenant contact + phone", "Project size, cost & timing", "Call opener for your trade"] },
  { key: "trade", name: "Trade Pack", kind: "pack", price: 149, projects: 9, contacts: 0,
    points: ["9 verified new openings & remodels", "Owner or tenant contact + phone", "Project size, cost & timing", "Call opener for your trade"] },
  { key: "growth", name: "Growth Pack", kind: "pack", price: 199, projects: 13, contacts: 0, best: true,
    points: ["13 verified new openings & remodels", "Owner or tenant contact + phone", "Project size, cost & timing", "Call opener for your trade"] },
  { key: "pro", name: "Pro Bundle", kind: "pack", price: 249, projects: 16, contacts: 50,
    points: ["16 verified new openings & remodels", "+ 50 basic business contacts (name, address, phone)", "Call openers for your trade", "Spreadsheet download"] },
];

export const PLANS: Product[] = [
  { key: "local", name: "Local Plan", kind: "subscription", price: 99, projects: 6, contacts: 0,
    points: ["At least 6 new projects every month", "One trade, delivered each billing month", "Never the same project twice", "Short month? The difference carries to next month", "Cancel anytime"] },
  { key: "pro_plan", name: "Pro Plan", kind: "subscription", price: 179, projects: 12, contacts: 0, best: true,
    points: ["At least 12 new projects every month", "Sent in two batches a month so you call first", "Spreadsheet export", "Never the same project twice", "Cancel anytime"] },
];

export const PRODUCTS: Product[] = [...PACKS, ...PLANS];
export const productByKey = (k: unknown) => PRODUCTS.find((p) => p.key === k) ?? null;
export const perProject = (p: Product) => Math.round((p.price / p.projects) * 100) / 100;

/** Public Buy URL: goes through the capacity gate, never straight to Square. */
export const buyHref = (product: ProductKey, tradeSlug?: string | null, base = "") =>
  `${base}/new-openings/buy?product=${product}${tradeSlug ? `&trade=${encodeURIComponent(tradeSlug)}` : ""}`;

/** Only ever forward buyers to Square-hosted checkout. */
export const isSquareCheckoutLink = (u: string) => /^https:\/\/(square\.link\/u\/[A-Za-z0-9]+|checkout\.square\.site\/[^\s]+)$/.test(u);

/** Delivery page for one order (revocable, recorded). */
export const deliveryHref = (token: string, base = "") => `${base}/lp/o/${token}`;

export function shortfallCopy(available: number, wanted: number) {
  return available <= 0
    ? "Your trade's list is full right now: 3 companies already have every open project. New projects are added as they're filed; text us to get on the waitlist."
    : `Only ${available} open project${available === 1 ? "" : "s"} left for your trade right now (this pack has ${wanted}). Pick a smaller pack, or text us to get on the waitlist.`;
}
