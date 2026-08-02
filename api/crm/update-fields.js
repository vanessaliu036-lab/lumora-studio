// Vercel serverless: update editable CRM work fields from the admin backend.
const BASE = 'appOLY56Y7cNExxzs';
const CRM = 'tblWtB7qlAQQTYS9v';
const API = `https://api.airtable.com/v0/${BASE}`;
const PAT = process.env.AIRTABLE_PAT;

const FIELD_MAP = {
  summary: 'Inquiry Summary',
  budget: 'Budget Range',
  lastContact: 'Last Contact',
  nextFollowUp: 'Next Follow-up',
  followupNote: 'Follow-up Note',
  quoted: 'Quoted Amount',
  method: 'Payment Method',
};

function normalizeValue(key, value) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  if (key === 'quoted') {
    const numeric = Number(String(value).replace(/[^\d.-]/g, ''));
    if (!Number.isFinite(numeric)) throw new Error('報價金額必須是數字');
    return numeric;
  }
  return String(value).trim();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  if (!PAT) return res.status(500).json({ ok: false, error: 'AIRTABLE_PAT is not configured' });

  const { recordId, fields } = req.body || {};
  if (!recordId || !fields || typeof fields !== 'object') return res.status(400).json({ ok: false, error: 'recordId and fields are required' });

  try {
    const airtableFields = {};
    for (const [key, fieldName] of Object.entries(FIELD_MAP)) {
      if (Object.prototype.hasOwnProperty.call(fields, key)) airtableFields[fieldName] = normalizeValue(key, fields[key]);
    }
    if (!Object.keys(airtableFields).length) return res.status(400).json({ ok: false, error: 'No editable CRM fields supplied' });
    const response = await fetch(`${API}/${CRM}/${encodeURIComponent(recordId)}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${PAT}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: airtableFields, typecast: true }),
    });
    const payload = await response.json();
    if (!response.ok) return res.status(response.status).json({ ok: false, error: payload?.error?.message || 'CRM field update failed' });
    return res.status(200).json({ ok: true, recordId: payload.id, fields: airtableFields });
  } catch (error) {
    return res.status(500).json({ ok: false, error: String(error.message || error) });
  }
}
