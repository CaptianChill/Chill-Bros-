import "server-only";
export function marketBase() {
  const base = String(process.env.LEAD_MARKET_APP_URL || process.env.NEXT_PUBLIC_APP_URL || "https://chill-bros.vercel.app").replace(/\/+$/, "");
  const url = new URL(base);
  if (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && url.hostname === "localhost")) throw new Error("Marketplace URL must use HTTPS.");
  return url.origin;
}
