// Vercel serverless: Airtable Partners 完整紀錄
const BASE = 'appOLY56Y7cNExxzs';
const PARTNERS = 'tblF3paIolcwlzu6v';
const API = `https://api.airtable.com/v0/${BASE}`;
const PAT = process.env.AIRTABLE_PAT;
const numberValue = value => {
  if (typeof value === 'number') return value;
  const parsed = Number(String(value ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

async function atList(table, formula = '', max = 100) {
  const url = new URL(`${API}/${table}`);
  url.searchParams.set('pageSize', String(max));
  if (formula) url.searchParams.set('filterByFormula', formula);
  const r = await fetch(url, { headers: { Authorization: `Bearer ${PAT}` } });
  if (!r.ok) throw new Error(`Airtable ${table}: ${r.status}`);
  return (await r.json()).records || [];
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  try {
    const rows = await atList(PARTNERS, '', 100);
    const out = rows.map(r => {
      const f = r.fields;
      const limit = numberValue(f['Plan Limit']);
      const used = numberValue(f['Used Orders']);
      const revenue = numberValue(f.Revenue);
      const plan = f.Subscription || '';
      const planAmount = revenue;
      return {
        id: r.id, name: f['Brand Name'] || f['Partner Name'] || f['Partner ID'] || '', code: f['Partner Code'] || '',
        contact: f.Owner || '', brand: f['Brand Name'] || f['Partner Name'] || f['Partner ID'] || '',
        tgId: '', tgUser: f.Telegram || '',
        onboard: f['Onboarding Status'] || '',
        team: '',
        plan,
        planAmount,
        currency: f.Currency || 'USD',
        subscriptionStatus: f['Subscription Status'] || f.Status || '',
        limit, used,
        remain: limit - used,
        period: '總量制',
        planStart: f['Last Login'] || '',
        planExpiry: f.Renewal || '',
        planStatus: f['Plan Status'] || '',
        renewal: f['Renewal Alert'] || '',
        partnerPaid: f.Status || '',
        submitted: f['CRM Submitted'] || 0,
        received: f['CRM Received'] || 0,
        diff: f['Transfer Difference'] || 0,
        sync: f['Sync Status'] || '',
        webhook: f['Webhook Status'] || '',
        lastSync: f['Last Alert Sent'] || '',
        lastAlert: f['Last Alert Sent'] || '',
        converted: 0,
        convRate: f['Conversion Rate %'] ?? '',
        revenue,
        aov: '',
        commRate: f['Commission Rate %'] ?? '',
        commEarned: '',
        commUnpaid: f['Unpaid Commission'] || 0,
        lastOrder: '',
        notes: '',
      };
    });
    res.statusCode = 200;
    res.json({ ok: true, records: out });
  } catch (e) {
    res.statusCode = 500;
    res.json({ ok: false, error: String(e.message || e) });
  }
}
