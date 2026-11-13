import { neon } from '@neondatabase/serverless';

export const db = () => neon(process.env.DATABASE_URL);
export const body = (req) => (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}));
export const clean = (v, max = 300) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
export const BUYER_STATUSES = ['new', 'contacted', 'quoted', 'booked', 'lost'];
export const OWNER_LEAD_STATUSES = ['new', 'assigned', 'sold', 'junk'];
export function noStore(res) { res.setHeader('Cache-Control', 'no-store'); }
export const clientIp = (req) => String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
const hits = new Map();
// Simple in-memory sliding-window limiter. Good enough on a warm Vercel function;
// resets on cold start, which just means a fresh window, not an open door.
export function rateLimit(key, max, windowMs) {
  const now = Date.now();
  const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
  arr.push(now);
  hits.set(key, arr);
  if (hits.size > 5000) { for (const [k, v] of hits) { if (now - v[v.length - 1] > windowMs) hits.delete(k); } }
  return arr.length <= max;
}
