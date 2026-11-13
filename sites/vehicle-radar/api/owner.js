import crypto from 'node:crypto';
import { db, body, clean, OWNER_LEAD_STATUSES, noStore, rateLimit, clientIp } from './_util.js';

const CARD_STATUSES = ['new', 'working', 'sent', 'won', 'dead'];

const lines = (v) => clean(v, 4000).split('\n').map((s) => s.trim()).filter(Boolean);

export default async function handler(req, res) {
  noStore(res);
  if (!rateLimit(`owner:${clientIp(req)}`, 10, 10 * 60 * 1000)) return res.status(429).json({ error: 'Too many attempts. Please wait a few minutes and try again.' });
  if (!process.env.ADMIN_PIN || req.headers['x-admin-pin'] !== process.env.ADMIN_PIN) return res.status(401).json({ error: 'Wrong PIN' });
  const sql = db();
  try {
    if (req.method === 'GET') {
      const [leads, prospects, buyers, assignments] = await Promise.all([
        sql`SELECT * FROM leads ORDER BY created_at DESC LIMIT 1000`,
        sql`SELECT * FROM prospects ORDER BY score, created_at DESC LIMIT 2000`,
        sql`SELECT * FROM buyers ORDER BY created_at DESC LIMIT 500`,
        sql`SELECT * FROM assignments ORDER BY assigned_at DESC LIMIT 2000`,
      ]);
      return res.status(200).json({ leads, prospects, buyers, assignments });
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const b = body(req);
    switch (b.action) {
      case 'create_buyer': {
        const name = clean(b.business_name, 160);
        if (!name) return res.status(400).json({ error: 'Business name is required.' });
        const token = crypto.randomBytes(18).toString('base64url');
        const services = Array.isArray(b.services) && b.services.length ? b.services.map((s) => clean(s, 40)).filter(Boolean) : ['PPF', 'Vinyl'];
        const [row] = await sql`INSERT INTO buyers (business_name, contact_name, phone, email, services, token, notes)
          VALUES (${name}, ${clean(b.contact_name, 120)}, ${clean(b.phone, 40)}, ${clean(b.email, 160)}, ${services}, ${token}, ${clean(b.notes, 1000)}) RETURNING *`;
        return res.status(200).json({ ok: true, buyer: row });
      }
      case 'set_buyer_active':
        await sql`UPDATE buyers SET active = ${b.active === true} WHERE id = ${Number(b.id)}`;
        return res.status(200).json({ ok: true });
      case 'new_buyer_link': {
        const token = crypto.randomBytes(18).toString('base64url');
        await sql`UPDATE buyers SET token = ${token} WHERE id = ${Number(b.id)}`;
        return res.status(200).json({ ok: true, token });
      }
      case 'assign_lead': {
        const buyer = b.buyer_id ? Number(b.buyer_id) : null;
        await sql`UPDATE leads SET buyer_id = ${buyer}, assigned_at = ${buyer ? new Date().toISOString() : null},
          buyer_status = 'new', status = ${buyer ? 'assigned' : 'new'} WHERE id = ${Number(b.id)}`;
        return res.status(200).json({ ok: true });
      }
      case 'lead_status':
        if (!OWNER_LEAD_STATUSES.includes(b.status)) return res.status(400).json({ error: 'Bad status' });
        await sql`UPDATE leads SET status = ${b.status} WHERE id = ${Number(b.id)}`;
        return res.status(200).json({ ok: true });
      case 'lead_note':
        await sql`UPDATE leads SET owner_notes = ${clean(b.note, 2000)} WHERE id = ${Number(b.id)}`;
        return res.status(200).json({ ok: true });
      case 'assign_card':
        await sql`INSERT INTO assignments (prospect_id, buyer_id) VALUES (${Number(b.prospect_id)}, ${Number(b.buyer_id)}) ON CONFLICT DO NOTHING`;
        await sql`UPDATE prospects SET owner_status = 'sent', updated_at = now() WHERE id = ${Number(b.prospect_id)} AND owner_status IN ('new', 'working')`;
        return res.status(200).json({ ok: true });
      case 'card_status':
        if (!CARD_STATUSES.includes(b.status)) return res.status(400).json({ error: 'Bad status' });
        await sql`UPDATE prospects SET owner_status = ${b.status}, updated_at = now() WHERE id = ${Number(b.id)}`;
        return res.status(200).json({ ok: true });
      case 'card_note':
        await sql`UPDATE prospects SET owner_notes = ${clean(b.note, 2000)}, updated_at = now() WHERE id = ${Number(b.id)}`;
        return res.status(200).json({ ok: true });
      case 'unassign_card':
        await sql`DELETE FROM assignments WHERE prospect_id = ${Number(b.prospect_id)} AND buyer_id = ${Number(b.buyer_id)}`;
        return res.status(200).json({ ok: true });
      case 'create_card': {
        const name = clean(b.name, 160);
        if (!name) return res.status(400).json({ error: 'Business name is required.' });
        const contact = lines(b.contact).map((l) => { const i = l.indexOf(':'); return i > 0 ? { label: l.slice(0, i).trim(), value: l.slice(i + 1).trim() } : { label: 'Info', value: l }; });
        const score = ['A', 'B', 'C'].includes(b.score) ? b.score : 'B';
        const [row] = await sql`INSERT INTO prospects (name, score, need, type, contact, why, pitch, script, value, source_note, found_by)
          VALUES (${name}, ${score}, ${clean(b.need, 80)}, ${clean(b.type, 80)}, ${JSON.stringify(contact)}::jsonb, ${JSON.stringify(lines(b.why))}::jsonb,
                  ${JSON.stringify(lines(b.pitch))}::jsonb, ${clean(b.script, 2000)}, ${clean(b.value, 1000)},
                  ${clean(b.source_note, 300) || 'Lead pulled from public sources. Confirm the decision-maker before your visit.'}, 'Added by owner') RETURNING *`;
        return res.status(200).json({ ok: true, card: row });
      }
      default:
        return res.status(400).json({ error: 'Unknown action' });
    }
  } catch (e) {
    console.error('[owner]', e);
    return res.status(500).json({ error: 'Server error' });
  }
}
