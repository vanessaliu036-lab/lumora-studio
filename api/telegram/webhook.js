// Telegram webhook: customer confirmation is the hard gate before style production.
const BASE = 'appOLY56Y7cNExxzs';
const ORDERS = 'tblJix6eujPrblpIv';
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

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).json({ ok: true });
  if (!process.env.TELEGRAM_WEBHOOK_SECRET || req.headers['x-telegram-bot-api-secret-token'] !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return res.status(401).json({ ok: false, error: 'Invalid webhook secret' });
  }
  try {
    const callback = req.body?.callback_query;
    if (!callback?.data) return res.status(200).json({ ok: true });
    const [action, recordId] = String(callback.data).split(':');
    if (!recordId || !['identity_confirm', 'identity_redo'].includes(action)) return res.status(200).json({ ok: true });

    await telegram('answerCallbackQuery', { callback_query_id: callback.id });
    const order = await airtable(`${ORDERS}/${encodeURIComponent(recordId)}`);
    const orderId = order.fields?.['Order ID'] || recordId;

    if (action === 'identity_confirm') {
      await airtable(`${ORDERS}/${encodeURIComponent(recordId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ fields: {
          'Production Status': 'Generating 生成中',
          'Missing Assets Note': '客戶已確認基準照，可套用所選風格',
        }, typecast: true }),
      });
      await telegram('sendMessage', { chat_id: callback.message.chat.id,
        text: `✅ 已確認基準照（${orderId}）\n\n接下來開始套用你選擇的風格。完成後會再通知你。` });
    } else {
      const origin = `https://${req.headers.host}`;
      await fetch(`${origin}/api/orders/generate-identity`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recordId }),
      });
      await telegram('sendMessage', { chat_id: callback.message.chat.id,
        text: `已收到重新生成要求（${orderId}），請稍候查看新的基準照。` });
    }
    return res.status(200).json({ ok: true, action, recordId });
  } catch (error) {
    return res.status(500).json({ ok: false, error: String(error.message || error) });
  }
}
