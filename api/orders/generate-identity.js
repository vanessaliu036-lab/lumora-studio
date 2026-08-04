// Staff action: send the manually produced style portrait to the customer in Telegram.
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

async function telegramPhoto(chatId, photo, caption, replyMarkup) {
  if (photo.type === 'url') {
    return telegram('sendPhoto', {
      chat_id: chatId,
      photo: photo.value,
      caption,
      reply_markup: replyMarkup,
    });
  }

  const form = new FormData();
  form.append('chat_id', String(chatId));
  form.append('photo', new Blob([photo.data], { type: 'image/png' }), 'lumora-style-portrait.png');
  form.append('caption', caption);
  form.append('reply_markup', JSON.stringify(replyMarkup));
  const response = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendPhoto`, {
    method: 'POST',
    body: form,
  });
  const payload = await response.json();
  if (!response.ok || !payload.ok) throw new Error(payload?.description || `Telegram request failed: ${response.status}`);
  return payload;
}

async function generatePreview(referenceFiles) {
  if (!process.env.OPENAI_API_KEY) return process.env.IDENTITY_PREVIEW_URL || null;
  const reference = referenceFiles.find(file => file?.url)?.url;
  if (!reference) return null;

  const source = await fetch(reference);
  if (!source.ok) throw new Error(`Reference image download failed: ${source.status}`);
  const sourceBytes = await source.arrayBuffer();
  const form = new FormData();
  form.append('model', 'gpt-image-1');
  form.append('prompt', 'Create a realistic personal style portrait from this person reference. Preserve the person\'s facial structure, recognizable features, skin tone, hair, and overall identity. Apply the selected editorial style with polished lighting, natural expression, no text, no watermark.');
  form.append('input_fidelity', 'high');
  form.append('size', '1024x1536');
  form.append('quality', 'medium');
  form.append('image', new Blob([sourceBytes], { type: source.headers.get('content-type') || 'image/jpeg' }), 'reference.jpg');

  const response = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: form,
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message || 'OpenAI identity image generation failed');
  const encoded = payload?.data?.[0]?.b64_json;
  if (!encoded) throw new Error('OpenAI returned no image data');
  return { type: 'buffer', data: Buffer.from(encoded, 'base64') };
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
    const { recordId, previewUrl, previewDataUrl } = req.body || {};
    if (!recordId) return res.status(400).json({ ok: false, error: 'recordId is required' });

    const order = await airtable(`${ORDERS}/${encodeURIComponent(recordId)}`);
    const crmId = Array.isArray(order.fields?.CRM) ? order.fields.CRM[0] : '';
    if (!crmId) return res.status(400).json({ ok: false, error: 'Order is not linked to a CRM record' });
    const crm = await airtable(`${CRM}/${encodeURIComponent(crmId)}`);
    const tgId = crm.fields?.['Telegram User ID'];
    if (!tgId) return res.status(400).json({ ok: false, error: 'CRM record has no Telegram User ID' });

    const image = previewUrl
      ? { type: 'url', value: previewUrl }
      : previewDataUrl?.startsWith('data:image/')
        ? { type: 'buffer', data: Buffer.from(previewDataUrl.split(',')[1] || '', 'base64') }
      : await generatePreview(crm.fields?.['Reference Files'] || []);
    if (!image) return res.status(500).json({ ok: false, error: 'OPENAI_API_KEY is required for GPT image generation.' });
    const orderId = order.fields?.['Order ID'] || recordId;
    const replyMarkup = { inline_keyboard: [[
      { text: '✓ 確認', callback_data: `identity_confirm:${recordId}` },
      { text: '↻ 再生成一張', callback_data: `identity_redo:${recordId}` },
    ]] };
    const sent = await telegramPhoto(
      tgId,
      image,
      `這是您的個人風格形象圖（${orderId}）\n\n謝謝您使用 Lumora Studio，請確認這張是否符合您的期待。`,
      replyMarkup,
    );
    const deliveredPhoto = sent?.result?.photo?.at(-1);
    const storedImage = image.type === 'url'
      ? image.value
      : `telegram_file_id:${deliveredPhoto?.file_id || ''}`;

    await airtable(`${ORDERS}/${encodeURIComponent(recordId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ fields: {
        Download: storedImage,
        'Production Status': 'Review 審核中',
        'Asset Status': '素材齊全',
        'Missing Assets Note': '個人風格形象圖已傳送至 TG，等待客戶確認',
      }, typecast: true }),
    });
    return res.status(200).json({ ok: true, orderId, status: 'Review 審核中' });
  } catch (error) {
    return res.status(500).json({ ok: false, error: String(error.message || error) });
  }
}
