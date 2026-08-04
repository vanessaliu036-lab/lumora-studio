// Staff action: send the identity preview to the customer in Telegram.
// The next production step is locked until the customer presses Confirm.
const BASE = 'appOLY56Y7cNExxzs';
const ORDERS = 'tblJix6eujPrblpIv';
const CRM = 'tblWtB7qlAQQTYS9v';
const API = `https://api.airtable.com/v0/${BASE}`;

async function airtable(path, options = {}) {
  const response = await fetch(`${API}/${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${process.env.AIRTABLE_PAT}`, 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message || `Airtable request failed: ${response.status}`);
  return payload;
}

async function telegram(method, body) {
  const response = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok || !payload.ok) throw new Error(payload?.description || `Telegram request failed: ${response.status}`);
  return payload;
}

async function generatePreview(referenceFiles) {
  if (!process.env.FAL_KEY) return process.env.IDENTITY_PREVIEW_URL || '';
  const reference = referenceFiles.find(file => file?.url)?.url;
  if (!reference) return '';
  const response = await fetch('https://fal.run/fal-ai/flux-kontext-pro', {
    method: 'POST',
    headers: { Authorization: `Key ${process.env.FAL_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: 'Create a realistic AI identity baseline portrait from this reference photo. Preserve facial structure and recognizable features. Neutral editorial light, no text, no watermark.',
      image_url: reference,
      num_images: 1,
    }),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.detail || 'Identity image generation failed');
  return payload?.images?.[0]?.url || '';
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  if (!process.env.AIRTABLE_PAT || !process.env.TELEGRAM_BOT_TOKEN) {
    return res.status(500).json({ ok: false, error: 'AIRTABLE_PAT and TELEGRAM_BOT_TOKEN are required' });
  }

  try {
    const { recordId, previewUrl } = req.body || {};
    if (!recordId) return res.status(400).json({ ok: false, error: 'recordId is required' });

    const order = await airtable(`${ORDERS}/${encodeURIComponent(recordId)}`);
    const crmId = Array.isArray(order.fields?.CRM) ? order.fields.CRM[0] : '';
    if (!crmId) return res.status(400).json({ ok: false, error: 'Order is not linked to a CRM record' });
    const crm = await airtable(`${CRM}/${encodeURIComponent(crmId)}`);
    const tgId = crm.fields?.['Telegram User ID'];
    if (!tgId) return res.status(400).json({ ok: false, error: 'CRM record has no Telegram User ID' });

    const image = previewUrl || await generatePreview(crm.fields?.['Reference Files'] || []);
    if (!image) return res.status(500).json({ ok: false, error: 'No identity generator configured. Set FAL_KEY or IDENTITY_PREVIEW_URL.' });
    const orderId = order.fields?.['Order ID'] || recordId;
    await telegram('sendPhoto', {
      chat_id: tgId,
      photo: image,
      caption: `這是你的 AI 個人照基準圖（${orderId}）\n\n請確認這張是否像你。確認後才會套用你選擇的風格。`,
      reply_markup: { inline_keyboard: [[
        { text: '✓ 確認這張', callback_data: `identity_confirm:${recordId}` },
        { text: '✗ 再生成一張', callback_data: `identity_redo:${recordId}` },
      ]] },
    });

    await airtable(`${ORDERS}/${encodeURIComponent(recordId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ fields: {
        Download: image,
        'Production Status': 'Review 審核中',
        'Asset Status': '素材齊全',
        'Missing Assets Note': '基準照已傳送至 TG，等待客戶確認',
      }, typecast: true }),
    });
    return res.status(200).json({ ok: true, orderId, status: 'Review 審核中' });
  } catch (error) {
    return res.status(500).json({ ok: false, error: String(error.message || error) });
  }
}
