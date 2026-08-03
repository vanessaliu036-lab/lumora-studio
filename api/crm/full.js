// Vercel serverless: Airtable CRM 完整紀錄（後台 admin.html fetch 用）
// runtime: nodejs20.x
const BASE = 'appOLY56Y7cNExxzs';
const CRM = 'tblWtB7qlAQQTYS9v';
const PARTNERS = 'tblF3paIolcwlzu6v';
const CUSTOMERS = 'tblAmgyZ0iN8Ka00a';
const API = `https://api.airtable.com/v0/${BASE}`;

const PAT = process.env.AIRTABLE_PAT;

async function atList(table, formula = '', max = 100) {
  const url = new URL(`${API}/${table}`);
  url.searchParams.set('pageSize', String(max));
  if (formula) url.searchParams.set('filterByFormula', formula);
  const r = await fetch(url, { headers: { Authorization: `Bearer ${PAT}` } });
  if (!r.ok) throw new Error(`Airtable ${table}: ${r.status} ${await r.text()}`);
  const d = await r.json();
  return d.records || [];
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  try {
    const [rows, allPartners, allCustomers] = await Promise.all([
      atList(CRM, '', 100),
      atList(PARTNERS, '', 50),
      atList(CUSTOMERS, '', 100),
    ]);
    const pById = Object.fromEntries(allPartners.map(p => [p.id, p.fields]));
    const cById = Object.fromEntries(allCustomers.map(c => [c.id, c.fields]));

    const out = rows.map(r => {
      const f = r.fields;
      let partnerCode = '';
      let partnerRec = '';
      const pl = f.Partner;
      if (Array.isArray(pl) && pl[0]) {
        partnerRec = pl[0];
        partnerCode = pById[pl[0]]?.['Partner Code'] || '';
      }
      let tgIdFromCustomer = '';
      const cl = f.Customer;
      if (Array.isArray(cl) && cl[0]) {
        tgIdFromCustomer = String(cById[cl[0]]?.['🤖 Telegram User ID'] || '');
      }
      const historyText = f['Status History'] || '';
      const history = historyText.split('\n').map(line => {
        const s = (line || '').trim();
        if (!s) return null;
        return { t: s, d: '', s: 'done' };
      }).filter(Boolean);
      return {
        id: r.id, crm_id: f['CRM ID'] || '',
        inqDate: f['Inquiry Date'] || '', name: f['Customer Name'] || '',
        service: f['Service Type'] || '',
        tgId: f['Telegram User ID'] || tgIdFromCustomer,
        tgUser: f['Telegram Username'] || '',
        partner: partnerRec, partnerCode,
        partnerWebsite: partnerRec ? (pById[partnerRec]?.['Official Website'] || pById[partnerRec]?.['Website URL'] || pById[partnerRec]?.['Partner URL'] || pById[partnerRec]?.['Tracking URL'] || pById[partnerRec]?.URL || '') : '',
        lang: f['Language'] || '', returning: !!f['Is Returning'],
        summary: f['Inquiry Summary'] || '',
        files: f['Reference Files'], hasFiles: !!f['Has Reference Files'],
        budget: f['Budget Range'] || '', pri: f['Priority'] || '',
        cs: f['Assigned Customer Service']?.name || '',
        status: f['CRM Status'] || '', lastContact: f['Last Contact'] || '',
        next: f['Next Follow-up'] || '',
        firstResp: f['First Response Hours'] ?? '',
        touch: f['Touch Count'] ?? 0, daysIn: f['Days in Status'] ?? '',
        note: f['Follow-up Note'] || '', history,
        blockerStatus: f['Follow-up Blocker'] || '',
        payStatus: f['Payment Status'] || '', quoted: f['Quoted Amount'] ?? '',
        method: f['Payment Method'] || '', transferDate: f['Transfer Date'] || '',
        last5: f['Account Last 5'] || '',
        last5valid: f['Last5 Valid'] ?? null,
        proof: f['Payment Proof'],
        locked: !!f['Payment Locked'],
        subBy: f['Submitted By']?.name || '',
        subAt: f['Submitted At'] || '',
        verBy: f['Verified By']?.name || '',
        verAt: f['Verified At'] || '',
        verNote: f['Verification Note'] || '',
        closeResult: f['Close Result'] || '', closedAt: f['Closed At'] || '',
        convOrder: f['Converted Order'] || '',
        lostReason: f['Lost Reason'] || '',
        daysToClose: f['Days to Close'] ?? '',
        botMsg: f['Bot Message ID'] || '',
        botSync: f['Bot Sync Status'] || '',
        createdBy: f['Created By'] || '',
        updated: f['Last Updated'] || '',
      };
    });
    res.statusCode = 200;
    res.json({ ok: true, records: out });
  } catch (e) {
    res.statusCode = 500;
    res.json({ ok: false, error: String(e.message || e) });
  }
}
