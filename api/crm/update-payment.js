// Vercel serverless: write the staff-entered bank account last five digits.
const BASE = 'appOLY56Y7cNExxzs';
const CRM = 'tblWtB7qlAQQTYS9v';
const ORDERS = 'tblJix6eujPrblpIv';
const API = `https://api.airtable.com/v0/${BASE}`;
const PAT = process.env.AIRTABLE_PAT;

async function telegram(method, body) {
  const response = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok || !payload.ok) throw new Error(payload?.description || `Telegram request failed: ${response.status}`);
  return payload;
}

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
            // 付款事實只存在 CRM；Orders 透過 CRM lookup 讀取 Payment Status。
            'Production Status': '新訂單',
          }, typecast: true }),
        });
        const orderPayload = await orderResponse.json();
        if (!orderResponse.ok) return res.status(orderResponse.status).json({ ok: false, error: orderPayload?.error?.message || 'Airtable Order create failed' });
      }
      if (orderId) {
        const linkedAt = new Date().toISOString();
        const linkResponse = await fetch(`${API}/${CRM}/${encodeURIComponent(recordId)}`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${PAT}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fields: {
              'Payment Locked': true,
              'CRM Status': 'Converted',
              'Converted Order': orderId,
              'Close Result': '成交',
              'Closed At': linkedAt,
              'Verified At': linkedAt,
            },
            typecast: true,
          }),
        });
        const linkPayload = await linkResponse.json();
        if (!linkResponse.ok) return res.status(linkResponse.status).json({ ok: false, error: linkPayload?.error?.message || 'CRM order link update failed' });
      }
      const telegramUserId = payload.fields?.['Telegram User ID'];
      if (telegramUserId && process.env.TELEGRAM_BOT_TOKEN) {
        try {
          await telegram('sendMessage', {
            chat_id: telegramUserId,
            text: `✅ 已收到款項，這是您的訂單\n\n編號：${payload.fields?.['CRM ID'] || recordId}\n\n由於 AI 政策規範，真人照片無法直接套用風格。\n請上傳 5 張清晰個人照。\n\n照片上傳完成後，請點擊下方「我已上傳」。\n\n隨時可以輸入 /status 查詢進度`,
            reply_markup: { inline_keyboard: [[
              { text: '📸 我已上傳', callback_data: `photos_uploaded:${recordId}` },
            ]] },
          });
        } catch (_) {
          // Payment confirmation remains successful if Telegram notification is temporarily unavailable.
        }
      }
    }
    return res.status(200).json({ ok: true, recordId: payload.id, orderId });
  } catch (error) {
    return res.status(500).json({ ok: false, error: String(error.message || error) });
  }
}
