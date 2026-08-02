// Vercel serverless: Airtable Orders 完整紀錄
const BASE = 'appOLY56Y7cNExxzs';
const ORDERS = 'tblJix6eujPrblpIv';
const CRM = 'tblWtB7qlAQQTYS9v';
const CUSTOMERS = 'tblAmgyZ0iN8Ka00a';
const PARTNERS = 'tblF3paIolcwlzu6v';
const API = `https://api.airtable.com/v0/${BASE}`;
const PAT = process.env.AIRTABLE_PAT;

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
    const [rows, allCrm, allCustomers, allPartners] = await Promise.all([
      atList(ORDERS, '', 100),
      atList(CRM, '', 100),
      atList(CUSTOMERS, '', 100),
      atList(PARTNERS, '', 50),
    ]);
    const crmById = Object.fromEntries(allCrm.map(r => [r.id, r.fields]));
    const custById = Object.fromEntries(allCustomers.map(r => [r.id, r.fields]));
    const ptnById = Object.fromEntries(allPartners.map(r => [r.id, r.fields]));

    const out = rows.map(r => {
      const f = r.fields;
      let name = f['Customer Name'] || '';
      let tgId = '';
      let service = '';
      let payStatus = '';
      let payMethod = '';
      let last5 = '';
      let verAt = '';
      const crmLinks = f.CRM;
      if (Array.isArray(crmLinks) && crmLinks[0]) {
        const cr = crmById[crmLinks[0]];
        if (cr) {
          name = cr['Customer Name'] || name;
          tgId = cr['Telegram User ID'] || '';
          service = cr['Service Type'] || '';
          payStatus = cr['Payment Status'] || '';
          payMethod = cr['Payment Method'] || '';
          last5 = cr['Account Last 5'] || '';
          verAt = cr['Verified At'] || '';
        }
      }
      let partnerCode = '';
      const pLinks = f.Partners;
      if (Array.isArray(pLinks) && pLinks[0]) {
        partnerCode = ptnById[pLinks[0]]?.['Partner Code'] || '';
      }
      let totalOrders = 0, ltv = 0, lastStyle = '';
      const custLinks = f.Customers;
      if (Array.isArray(custLinks) && custLinks[0]) {
        const cu = custById[custLinks[0]];
        if (cu) {
          totalOrders = cu['Total Orders'] || 0;
          ltv = cu['Lifetime Value'] || 0;
          lastStyle = cu['Last Style'] || '';
        }
      }
      const amount = f.Amount || 0;
      const cost = f['Actual Cost'] || 0;
      const margin = amount - cost;
      const marginPct = amount > 0 ? Math.round(margin / amount * 100) + '%' : '';
      return {
        id: r.id, orderId: f['Order ID'] || '',
        orderDate: f['Created At'] || '',
        crm: Array.isArray(crmLinks) ? (crmLinks[0] || '') : '',
        name, tgId,
        partner: Array.isArray(pLinks) ? (pLinks[0] || '') : '',
        partnerCode, service,
        pkg: Array.isArray(f['Order Tags']) ? f['Order Tags'][0] : '',
        qty: 1, amount, currency: 'USD',
        payStatus: payStatus || f.Payment || '',
        payMethod, last5, verAt,
        cost, commission: f['Partner Commission'] || 0,
        margin, marginPct,
        brief: f['Order Summary'] || '',
        style: Array.isArray(f['Order Tags']) ? f['Order Tags'][0] : '',
        producer: f.Consultant || '',
        asset: f['Asset Status'] || '',
        rev: f.Revision || 0,
        revLimit: f['Free Revision Limit'] || 2,
        assetNote: f['Missing Assets Note'] || '',
        promisedDate: f['Promised Date'] || '',
        deliveryDate: f['Completed At'] || '',
        daysLate: f['Days Late'] ?? '',
        completion: f['Completed At'] || '',
        link: f.Download || '',
        orderStatus: f['Production Status'] || '',
        totalOrders, ltv, lastStyle,
        consent: !!f['Consent Obtained'],
        retention: f['Photo Retention Until'] || '',
        purged: !!f['Photos Purged'],
        thread: '', notify: '',
        prevOrders: [],
      };
    });
    res.statusCode = 200;
    res.json({ ok: true, records: out });
  } catch (e) {
    res.statusCode = 500;
    res.json({ ok: false, error: String(e.message || e) });
  }
}
