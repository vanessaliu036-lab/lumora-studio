// Telegram webhook: customer confirmation is the hard gate before style production.
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

async function findCrmByFormula(formula) {
  const query = new URLSearchParams({ filterByFormula: formula, pageSize: '1' });
  const payload = await airtable(`${CRM}?${query.toString()}`);
  return payload.records?.[0] || null;
}

async function rememberTelegramUser(crmRecord, message) {
  if (!crmRecord?.id || !message?.from?.id) return;
  await airtable(`${CRM}/${encodeURIComponent(crmRecord.id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ fields: {
      'Telegram User ID': String(message.from.id),
    }, typecast: true }),
  });
}

async function handleStart(message) {
  const text = String(message.text || '').trim();
  const payload = text.split(/\s+/)[1] || '';
  const parts = payload.split('_');
  const crmId = parts[0] === 'order' ? parts[1] : '';
  let crmRecord = crmId ? await findCrmByFormula(`{CRM ID}='${crmId.replace(/'/g, "\\'")}'`) : null;
  if (!crmRecord && message.from?.id) {
    crmRecord = await findCrmByFormula(`{Telegram User ID}='${String(message.from.id).replace(/'/g, "\\'")}'`);
  }
  await rememberTelegramUser(crmRecord, message);
  const amount = parts[3] || crmRecord?.fields?.['Quoted Amount'] || '';
  const serviceText = parts[2] === 'portrait'
    ? 'Personal Identity'
    : crmRecord?.fields?.Package || crmRecord?.fields?.['Service Type'] || 'Lumora 個人形象照';
  const amountText = amount ? `USD $${amount}` : '請依網站訂單金額';
  await telegram('sendMessage', {
    chat_id: message.chat.id,
    text: `你好，歡迎來到 Lumora Studio ✨\n\n這邊跟你確認本次服務：\n方案：${serviceText}\n金額：${amountText}\n收款帳號：000-303-520\n\n完成付款後，請點擊下方「我已完成付款」，再回覆帳號後五碼。`,
    reply_markup: { inline_keyboard: [[
      { text: '✅ 我已完成付款', callback_data: `payment_done:${crmRecord?.id || 'none'}` },
    ]] },
  });
}

async function handlePhoto(message) {
  const userId = String(message.from?.id || '');
  const crmRecord = userId ? await findCrmByFormula(`{Telegram User ID}='${userId.replace(/'/g, "\\'")}'`) : null;
  await rememberTelegramUser(crmRecord, message);
  await telegram('sendMessage', {
    chat_id: message.chat.id,
    text: '✅ 已收到你的生活照，請繼續上傳照片。至少 5 張都收到後，真人客服會開始建立 AI 個人基準照。',
  });
}

async function handlePaymentLast5(message, req) {
  const last5 = String(message.text || '').trim();
  const userId = String(message.from?.id || '');
  const crmRecord = userId ? await findCrmByFormula(`{Telegram User ID}='${userId.replace(/'/g, "\\'")}'`) : null;
  if (!crmRecord) {
    await telegram('sendMessage', { chat_id: message.chat.id, text: '找不到對應的網站訂單，請重新從網站訂單連結進入 TG。' });
    return;
  }
  const origin = `https://${req.headers.host}`;
  const response = await fetch(`${origin}/api/crm/update-payment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recordId: crmRecord.id, last5, confirm: false }),
  });
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error(result.error || `Payment update failed: ${response.status}`);
  await telegram('sendMessage', {
    chat_id: message.chat.id,
    text: '✅ 已收到你的付款後五碼。\n\n客服會盡快人工確認付款，確認完成後會再回覆你下一步。',
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).json({ ok: true });
  if (!process.env.TELEGRAM_WEBHOOK_SECRET || req.headers['x-telegram-bot-api-secret-token'] !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return res.status(401).json({ ok: false, error: 'Invalid webhook secret' });
  }
  try {
    const message = req.body?.message;
    if (message?.text?.startsWith('/start')) {
      await handleStart(message);
      return res.status(200).json({ ok: true, event: 'start' });
    }
    if (/^\d{5}$/.test(String(message?.text || '').trim())) {
      await handlePaymentLast5(message, req);
      return res.status(200).json({ ok: true, event: 'payment_last5' });
    }
    if (message?.photo?.length) {
      await handlePhoto(message);
      return res.status(200).json({ ok: true, event: 'photo' });
    }
    const callback = req.body?.callback_query;
    if (!callback?.data) return res.status(200).json({ ok: true });
    const [action, recordId] = String(callback.data).split(':');
    if (action === 'payment_done') {
      await telegram('answerCallbackQuery', { callback_query_id: callback.id });
      await telegram('sendMessage', { chat_id: callback.message.chat.id,
        text: '✅ 已收到付款完成通知。\n\n請回覆你的「帳號後五碼」，客服確認後會通知你上傳 5 張生活照。' });
      return res.status(200).json({ ok: true, event: 'payment_done' });
    }
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
