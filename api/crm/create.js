// Create a real CRM inquiry from the public Telegram handoff form.
const BASE = 'appOLY56Y7cNExxzs';
const CRM = 'tblWtB7qlAQQTYS9v';
const API = `https://api.airtable.com/v0/${BASE}`;
const PAT = process.env.AIRTABLE_PAT;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  if (!PAT) return res.status(500).json({ ok: false, error: 'AIRTABLE_PAT is not configured' });

  try {
    const body = req.body || {};
    const name = String(body.name || '').trim();
    const service = String(body.service || '').trim();
    const summary = String(body.request || '').trim();
    if (!name || !service || !summary) return res.status(400).json({ ok: false, error: 'name, service and request are required' });

    const all = await fetch(`${API}/${CRM}?pageSize=100`, { headers: { Authorization: `Bearer ${PAT}` } });
    if (!all.ok) throw new Error(`Airtable CRM list failed: ${all.status}`);
    const records = (await all.json()).records || [];
    const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `CRM-${day}-`;
    const used = records.map(r => String(r.fields?.['CRM ID'] || '')).filter(id => id.startsWith(prefix)).map(id => Number(id.slice(prefix.length))).filter(Number.isFinite);
    const next = String((used.length ? Math.max(...used) : 0) + 1).padStart(3, '0');
    const crmId = `${prefix}${next}`;
    const createdAt = new Date().toISOString();
    const response = await fetch(`${API}/${CRM}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${PAT}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: {
        'CRM ID': crmId, 'Customer Name': name, 'CRM Status': 'New', 'Service Type': service,
        'Inquiry Summary': summary, 'Inquiry Date': createdAt, 'Created By': 'Telegram Bot',
      }, typecast: true }),
    });
    const payload = await response.json();
    if (!response.ok) return res.status(response.status).json({ ok: false, error: payload?.error?.message || 'Airtable CRM create failed' });
    return res.status(201).json({ ok: true, crmId, recordId: payload.id });
  } catch (error) {
    return res.status(500).json({ ok: false, error: String(error.message || error) });
  }
}
