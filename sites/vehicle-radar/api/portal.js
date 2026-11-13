import { db, body, clean, BUYER_STATUSES, noStore } from './_util.js';

export default async function handler(req, res) {
  noStore(res);
  const token = clean(req.headers['x-portal-token'] || '', 80);
  if (token.length < 20) return res.status(401).json({ error: 'This link is not valid.' });
  const sql = db();
  try {
    const [buyer] = await sql`SELECT id, business_name, contact_name, services, active FROM buyers WHERE token = ${token}`;
    if (!buyer || !buyer.active) return res.status(401).json({ error: 'This link is not active. Contact your account manager.' });
    if (req.method === 'GET') {
      const [leads, cards] = await Promise.all([
        sql`SELECT id, created_at, assigned_at, kind, company, fleet_size, vehicle_types, name, phone, email, vehicle, service, coverage, timeline, zip, notes, buyer_status, buyer_notes
            FROM leads WHERE buyer_id = ${buyer.id} ORDER BY assigned_at DESC NULLS LAST`,
        sql`SELECT a.id AS assignment_id, a.assigned_at, a.buyer_status, a.buyer_notes, p.id, p.name, p.score, p.need, p.type, p.contact, p.why, p.pitch, p.script, p.value, p.source_note
            FROM assignments a JOIN prospects p ON p.id = a.prospect_id WHERE a.buyer_id = ${buyer.id} ORDER BY a.assigned_at DESC`,
      ]);
      return res.status(200).json({ buyer: { business_name: buyer.business_name, contact_name: buyer.contact_name, services: buyer.services }, leads, cards });
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const b = body(req);
    if (!BUYER_STATUSES.includes(b.status)) return res.status(400).json({ error: 'Bad status' });
    const notes = clean(b.notes, 2000);
    if (b.kind === 'lead') {
      await sql`UPDATE leads SET buyer_status = ${b.status}, buyer_notes = ${notes} WHERE id = ${Number(b.id)} AND buyer_id = ${buyer.id}`;
    } else if (b.kind === 'card') {
      await sql`UPDATE assignments SET buyer_status = ${b.status}, buyer_notes = ${notes} WHERE id = ${Number(b.id)} AND buyer_id = ${buyer.id}`;
    } else return res.status(400).json({ error: 'Bad request' });
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('[portal]', e);
    return res.status(500).json({ error: 'Server error' });
  }
}
