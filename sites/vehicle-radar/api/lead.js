import { db, body, clean, rateLimit, clientIp } from './_util.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(`lead:${clientIp(req)}`, 5, 60 * 60 * 1000)) return res.status(429).json({ error: 'Too many requests. Please try again in a bit.' });
  const b = body(req);
  if (b.website) return res.status(200).json({ ok: true }); // honeypot
  const kind = b.kind === 'commercial' ? 'commercial' : 'local';
  const name = clean(b.name, 120), phone = clean(b.phone, 40);
  if (!name || phone.replace(/\D/g, '').length < 10) return res.status(400).json({ error: 'Please enter your name and a valid phone number.' });
  if (kind === 'commercial' && !clean(b.company, 160)) return res.status(400).json({ error: 'Please enter your business name.' });
  if (b.consent !== true) return res.status(400).json({ error: 'Please check the box so an installer can contact you.' });
  try {
    await db()`INSERT INTO leads (kind, name, phone, email, company, fleet_size, vehicle_types, vehicle, service, coverage, timeline, zip, notes, source, consent)
      VALUES (${kind}, ${name}, ${phone}, ${clean(b.email, 160)}, ${clean(b.company, 160)}, ${clean(b.fleet_size, 40)}, ${clean(b.vehicle_types, 200)},
              ${clean(b.vehicle, 160)}, ${clean(b.service, 80)}, ${clean(b.coverage, 80)}, ${clean(b.timeline, 60)}, ${clean(b.zip, 10)},
              ${clean(b.notes, 1000)}, ${clean(b.source, 120)}, true)`;
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('[lead]', e);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}
