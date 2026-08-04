// Update the operational status fields on an Airtable Order.
const BASE = 'appOLY56Y7cNExxzs';
const ORDERS = 'tblJix6eujPrblpIv';
const API = `https://api.airtable.com/v0/${BASE}`;
const PAT = process.env.AIRTABLE_PAT;

const FIELD_MAP = {
  productionStatus: 'Production Status',
  assetStatus: 'Asset Status',
  producer: 'Consultant',
  scheduleDate: 'Scheduled At',
  link: 'Download',
  assetNote: 'Missing Assets Note',
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  if (!PAT) return res.status(500).json({ ok: false, error: 'AIRTABLE_PAT is not configured' });

  const { recordId, fields } = req.body || {};
  if (!recordId || !fields || typeof fields !== 'object') return res.status(400).json({ ok: false, error: 'recordId and fields are required' });

  const airtableFields = {};
  for (const [key, fieldName] of Object.entries(FIELD_MAP)) {
    if (Object.prototype.hasOwnProperty.call(fields, key)) airtableFields[fieldName] = fields[key] === '' ? null : fields[key];
  }
  if (!Object.keys(airtableFields).length) return res.status(400).json({ ok: false, error: 'No editable Order fields supplied' });

  try {
    const response = await fetch(`${API}/${ORDERS}/${encodeURIComponent(recordId)}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${PAT}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: airtableFields, typecast: true }),
    });
    const payload = await response.json();
    if (!response.ok) return res.status(response.status).json({ ok: false, error: payload?.error?.message || 'Order update failed' });
    return res.status(200).json({ ok: true, recordId: payload.id, fields: airtableFields });
  } catch (error) {
    return res.status(500).json({ ok: false, error: String(error.message || error) });
  }
}
