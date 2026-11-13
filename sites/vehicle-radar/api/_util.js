import { neon } from '@neondatabase/serverless';

export const db = () => neon(process.env.DATABASE_URL);
export const body = (req) => (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}));
export const clean = (v, max = 300) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
export const BUYER_STATUSES = ['new', 'contacted', 'quoted', 'booked', 'lost'];
export const OWNER_LEAD_STATUSES = ['new', 'assigned', 'sold', 'junk'];
export function noStore(res) { res.setHeader('Cache-Control', 'no-store'); }
