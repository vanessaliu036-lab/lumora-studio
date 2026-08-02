// Vercel serverless: update the CRM workflow status from the admin drawer.
const BASE = 'appOLY56Y7cNExxzs';
const CRM = 'tblWtB7qlAQQTYS9v';
const API = `https://api.airtable.com/v0/${BASE}`;
const PAT = process.env.AIRTABLE_PAT;
const STATUS_OPTIONS = new Set([
  'New', 'Contacted', 'Discussing', 'Waiting Customer',
  'Ready to Close', 'Closed Won', 'Converted', 'Closed Lost',
]);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  if (!PAT) return res.status(500).json({ ok: false, error: 'AIRTABLE_PAT is not configured' });

  const { recordId, status } = req.body || {};
  if (!recordId || !STATUS_OPTIONS.has(String(status || ''))) {
    return res.status(400).json({ ok: false, error: 'recordId and a valid CRM status are required' });
  }

  try {
    const recordUrl = `${API}/${CRM}/${encodeURIComponent(recordId)}`;
    const currentResponse = await fetch(recordUrl, { headers: { Authorization: `Bearer ${PAT}` } });
    if (!currentResponse.ok) return res.status(currentResponse.status).json({ ok: false, error: `CRM record lookup failed: ${currentResponse.status}` });
    const current = await currentResponse.json();
    const previousHistory = String(current.fields?.['Status History'] || '').trim();
    const historyEntry = `${new Date().toISOString()} · ${status} · Admin 後台`;
    const statusHistory = [previousHistory, historyEntry].filter(Boolean).join('\n');
    const response = await fetch(recordUrl, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${PAT}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: { 'CRM Status': status, 'Status History': statusHistory }, typecast: true }),
    });
    const payload = await response.json();
    if (!response.ok) return res.status(response.status).json({ ok: false, error: payload?.error?.message || 'CRM status update failed' });
    return res.status(200).json({ ok: true, recordId: payload.id, status: payload.fields?.['CRM Status'] || status });
  } catch (error) {
    return res.status(500).json({ ok: false, error: String(error.message || error) });
  }
}
