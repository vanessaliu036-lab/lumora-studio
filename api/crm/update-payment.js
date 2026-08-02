// Vercel serverless: write the staff-entered bank account last five digits.
const BASE = 'appOLY56Y7cNExxzs';
const CRM = 'tblWtB7qlAQQTYS9v';
const ORDERS = 'tblJix6eujPrblpIv';
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
    const { recordId, last5, confirm } = req.body || {};
    if (!recordId || !/^\d{5}$/.test(String(last5 || ''))) {
      return res.status(400).json({ ok: false, error: 'recordId and a 5-digit last5 are required' });
    }

    const response = await fetch(`${API}/${CRM}/${encodeURIComponent(recordId)}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${PAT}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          fldoEQxMpsAdrK7bo: String(last5),
          // Airtable CRM 的 Payment Status 選項是 Confirmed，不能寫入 Paid。
          fldVJoRnj7Jh4YGu1: confirm ? 'Confirmed' : 'Pending Verification',
          fldUexjkaTZrvYVEx: 'Bank',
        },
        typecast: true,
      }),
    });
    const payload = await response.json();
    if (!response.ok) return res.status(response.status).json({ ok: false, error: payload?.error?.message || 'Airtable update failed' });
    let orderId = null;
    if (confirm) {
      const existingResponse = await fetch(`${API}/${ORDERS}?pageSize=100`, { headers: { Authorization: `Bearer ${PAT}` } });
      if (!existingResponse.ok) throw new Error(`Airtable Orders list failed: ${existingResponse.status}`);
      const existing = (await existingResponse.json()).records || [];
      const alreadyCreated = existing.find(record => Array.isArray(record.fields?.CRM) && record.fields.CRM.includes(recordId));
      if (alreadyCreated) {
        orderId = alreadyCreated.fields?.['Order ID'] || null;
      } else {
        const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const prefix = `ORD-${day}-`;
        const used = existing.map(r => String(r.fields?.['Order ID'] || '')).filter(id => id.startsWith(prefix)).map(id => Number(id.slice(prefix.length))).filter(Number.isFinite);
        orderId = `${prefix}${String((used.length ? Math.max(...used) : 0) + 1).padStart(3, '0')}`;
        const orderResponse = await fetch(`${API}/${ORDERS}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${PAT}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ fields: {
            'Order ID': orderId, 'Created At': new Date().toISOString(), 'CRM': [recordId],
            'Payment': '已付款', 'Production Status': '新訂單', 'Customer Name': payload.fields?.['Customer Name'] || '',
            'Order Summary': payload.fields?.['Inquiry Summary'] || '', 'Promised Date': null,
          }, typecast: true }),
        });
        const orderPayload = await orderResponse.json();
        if (!orderResponse.ok) return res.status(orderResponse.status).json({ ok: false, error: orderPayload?.error?.message || 'Airtable Order create failed' });
      }
    }
    return res.status(200).json({ ok: true, recordId: payload.id, orderId });
  } catch (error) {
    return res.status(500).json({ ok: false, error: String(error.message || error) });
  }
}
