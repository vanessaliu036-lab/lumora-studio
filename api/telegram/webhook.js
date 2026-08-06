// Telegram webhook: customer confirmation is the hard gate before style production.
const BASE = 'appOLY56Y7cNExxzs';
const ORDERS = 'tblJix6eujPrblpIv';
const CRM = 'tblWtB7qlAQQTYS9v';
const API = `https://api.airtable.com/v0/${BASE}`;
let activeCrmRecord = null;

function appendConversationEntry(value, entry) {
  const existing = String(value || '').trim();
  const normalized = {
    id: String(entry.id || `message-${Date.now()}`),
    at: entry.at ? String(entry.at) : new Date().toISOString(),
    role: entry.role || 'system',
    kind: entry.kind || 'text',
    text: String(entry.text || '').trim(),
    telegramMessageId: entry.telegramMessageId ? String(entry.telegramMessageId) : null,
    senderName: entry.senderName ? String(entry.senderName) : null,
  };
  if (!normalized.text) return existing;
  const serialized = JSON.stringify(normalized);
  return existing ? `${existing}\n${serialized}` : serialized;
}

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
  if (method === 'sendMessage' && activeCrmRecord?.id && payload.result?.message_id) {
    await rememberConversationEntry(activeCrmRecord, {
      id: `bot-${payload.result.message_id}-${Date.now()}`,
      at: new Date().toISOString(),
      role: 'bot',
      kind: 'text',
      text: String(body?.text || ''),
      telegramMessageId: String(payload.result.message_id),
    });
  }
  return payload;
}

async function rememberConversationEntry(crmRecord, entry) {
  if (!crmRecord?.id || !entry?.text) return;
  try {
    const current = await airtable(`${CRM}/${encodeURIComponent(crmRecord.id)}`);
    const history = appendConversationEntry(current.fields?.['Status History'], entry);
    await airtable(`${CRM}/${encodeURIComponent(crmRecord.id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ fields: { 'Status History': history }, typecast: true }),
    });
  } catch (_) {
    // Conversation history is additive telemetry; never break payment or delivery handling.
  }
}

async function rememberIncomingMessage(message, kind = 'text') {
  if (!activeCrmRecord?.id || !message) return;
  const text = kind === 'photo'
    ? '客戶傳送了一張照片'
    : String(message.text || '').trim();
  if (!text) return;
  await rememberConversationEntry(activeCrmRecord, {
    id: `customer-${message.message_id || `${Date.now()}-${text.slice(0, 12)}`}`,
    at: new Date(message.date ? message.date * 1000 : Date.now()).toISOString(),
    role: 'customer',
    kind,
    text,
    telegramMessageId: message.message_id ? String(message.message_id) : null,
  });
}

async function findCrmByFormula(formula) {
  const query = new URLSearchParams({ filterByFormula: formula, pageSize: '1' });
  const payload = await airtable(`${CRM}?${query.toString()}`);
  return payload.records?.[0] || null;
}

async function findLatestCrmByTelegramUser(userId) {
  const query = new URLSearchParams({
    filterByFormula: `{Telegram User ID}='${String(userId).replace(/'/g, "\\'")}'`,
    pageSize: '100',
  });
  query.set('sort[0][field]', 'Inquiry Date');
  query.set('sort[0][direction]', 'desc');
  const payload = await airtable(`${CRM}?${query.toString()}`);
  return payload.records?.[0] || null;
}

async function rememberTelegramUser(crmRecord, message) {
  if (!crmRecord?.id || !message?.from?.id) return;
  activeCrmRecord = crmRecord;
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
    crmRecord = await findLatestCrmByTelegramUser(message.from.id);
  }
  if (!crmRecord) {
    await telegram('sendMessage', {
      chat_id: message.chat.id,
      text: '您好，感謝您選擇 Lumora Studio ✨\n\n請選擇你要生成的項目：',
      reply_markup: { inline_keyboard: [[
        { text: '👤 個人形象照', callback_data: 'select_service:portrait' },
        { text: '🎬 風格動態影像', callback_data: 'select_service:motion' },
      ]] },
    });
    return;
  }
  await rememberTelegramUser(crmRecord, message);
  await rememberIncomingMessage(message);
  const amount = parts[3] || crmRecord?.fields?.['Quoted Amount'] || '';
  const serviceText = parts[2] === 'portrait'
    ? 'Personal Identity'
    : crmRecord?.fields?.Package || crmRecord?.fields?.['Service Type'] || 'Lumora 個人形象照';
  const amountText = amount ? `USD $${amount}` : '請依網站訂單金額';
  await telegram('sendMessage', {
    chat_id: message.chat.id,
    text: `你好，歡迎來到 Lumora Studio ✨\n\n這邊跟你確認本次服務：\n方案：${serviceText}\n金額：${amountText}\n收款帳號：000-303-520\n\n完成付款後，請先直接輸入 5 位數帳號後五碼，再點擊下方「我已完成付款」，一次完成付款通知。`,
    reply_markup: { inline_keyboard: [[
      { text: '✅ 我已完成付款', callback_data: `payment_done:${crmRecord?.id || 'none'}` },
    ]] },
  });
}

async function handlePhoto(message) {
  const userId = String(message.from?.id || '');
  const crmRecord = userId ? await findLatestCrmByTelegramUser(userId) : null;
  await rememberTelegramUser(crmRecord, message);
  await telegram('sendMessage', {
    chat_id: message.chat.id,
    text: '✅ 已收到你的生活照，請繼續上傳照片。至少 5 張都收到後，真人客服會檢查相似度並直接套用風格。',
  });
}

async function handlePaymentLast5(message, req) {
  const last5 = String(message.text || '').trim();
  const userId = String(message.from?.id || '');
  const crmRecord = userId ? await findLatestCrmByTelegramUser(userId) : null;
  await rememberTelegramUser(crmRecord, message);
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
    text: '✅ 已收到你的付款後五碼。\n\n客服會盡快人工確認付款。',
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).json({ ok: true });
  if (!process.env.TELEGRAM_WEBHOOK_SECRET || req.headers['x-telegram-bot-api-secret-token'] !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return res.status(401).json({ ok: false, error: 'Invalid webhook secret' });
  }
  try {
    const message = req.body?.message;
    if (message?.from?.id && !message?.text?.startsWith('/start')) {
      activeCrmRecord = await findLatestCrmByTelegramUser(message.from.id);
      await rememberIncomingMessage(message, message.photo?.length ? 'photo' : 'text');
    }
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
    if (action === 'select_service') {
      try { await telegram('answerCallbackQuery', { callback_query_id: callback.id }); } catch (_) { /* expired callback */ }
      const serviceText = recordId === 'motion' ? '風格動態影像' : '個人形象照';
      const amountText = recordId === 'motion' ? 'USD $12' : 'USD $5';
      await telegram('sendMessage', { chat_id: callback.message.chat.id,
        text: `這邊跟你確認本次服務：\n\n方案：${serviceText}\n金額：${amountText}\n收款帳號：000-303-520\n\n完成付款後，請回覆 5 位數帳號後五碼。\n\n若你是從網站下單，請由網站訂單連結重新進入 TG，系統才會自動連動訂單。` });
      return res.status(200).json({ ok: true, event: 'service_selected', service: recordId });
    }
    if (action === 'payment_done') {
      try { await telegram('answerCallbackQuery', { callback_query_id: callback.id }); } catch (_) { /* continue CRM sync if Telegram query has expired */ }
      try {
        await telegram('editMessageReplyMarkup', {
          chat_id: callback.message.chat.id,
          message_id: callback.message.message_id,
          reply_markup: { inline_keyboard: [] },
        });
      } catch (_) { /* old messages may not be editable */ }
      const linkedCrm = recordId && recordId !== 'none'
        ? { id: recordId }
        : await findLatestCrmByTelegramUser(callback.from?.id || callback.message.chat.id);
      let alreadyPending = false;
      let alreadyPaid = false;
      if (linkedCrm?.id) {
        const currentCrm = await airtable(`${CRM}/${encodeURIComponent(linkedCrm.id)}`);
        const paymentStatus = String(currentCrm.fields?.fldVJoRnj7Jh4YGu1 || currentCrm.fields?.['Payment Status'] || currentCrm.fields?.Status || '').toLowerCase();
        alreadyPending = paymentStatus === 'pending verification';
        alreadyPaid = ['confirmed', 'paid', 'converted', 'completed'].some(value => paymentStatus.includes(value))
          || (Array.isArray(currentCrm.fields?.Order) && currentCrm.fields.Order.length > 0);
      }
      if (alreadyPaid) return res.status(200).json({ ok: true, event: 'payment_done_ignored_already_paid' });
      if (linkedCrm?.id && !alreadyPending) {
        await airtable(`${CRM}/${encodeURIComponent(linkedCrm.id)}`, {
          method: 'PATCH',
          body: JSON.stringify({ fields: {
            fldVJoRnj7Jh4YGu1: 'Pending Verification',
            fldUexjkaTZrvYVEx: 'Bank',
          }, typecast: true }),
        });
      }
      if (!alreadyPending) await telegram('sendMessage', { chat_id: callback.message.chat.id,
        text: '✅ 已收到付款完成通知。\n\n請回覆你的「帳號後五碼」，客服會盡快與你回覆。' });
      return res.status(200).json({ ok: true, event: 'payment_done' });
    }
    if (action === 'photos_uploaded') {
      try { await telegram('answerCallbackQuery', { callback_query_id: callback.id }); } catch (_) { /* expired callback */ }
      if (recordId && recordId !== 'none') {
        await airtable(`${CRM}/${encodeURIComponent(recordId)}`, {
          method: 'PATCH',
          body: JSON.stringify({ fields: {
            'Verification Note': '客戶已回覆已上傳 5 張清晰個人照，等待客服確認素材',
          }, typecast: true }),
        });
      }
      await telegram('sendMessage', { chat_id: callback.message.chat.id,
        text: '✅ 已收到您的照片上傳通知。\n\n客服會先人工確認照片清晰度與相似度，確認後直接套用您選擇的風格。' });
      return res.status(200).json({ ok: true, event: 'photos_uploaded' });
    }
    if (!recordId || !['identity_confirm', 'identity_redo'].includes(action)) return res.status(200).json({ ok: true });

    try { await telegram('answerCallbackQuery', { callback_query_id: callback.id }); } catch (_) { /* continue order sync if Telegram query has expired */ }
    const order = await airtable(`${ORDERS}/${encodeURIComponent(recordId)}`);
    const orderId = order.fields?.['Order ID'] || recordId;

    if (action === 'identity_confirm') {
      await airtable(`${ORDERS}/${encodeURIComponent(recordId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ fields: {
          'Production Status': '生產結案',
          'Missing Assets Note': '客戶已確認個人風格形象圖，訂單已結案',
        }, typecast: true }),
      });
      const crmId = Array.isArray(order.fields?.CRM) ? order.fields.CRM[0] : '';
      if (crmId) await airtable(`${CRM}/${encodeURIComponent(crmId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ fields: { 'Next Follow-up': null, 'Follow-up Note': '客戶已確認風格成品，訂單完成並結案' }, typecast: true }),
      });
      await telegram('sendMessage', { chat_id: callback.message.chat.id,
        text: `✅ 已確認您的個人風格形象圖（${orderId}）\n\n哇，你看起來超美的！✨\n感謝您使用 Lumora Studio，希望再次遇見您。\n\n✅ 訂單已完成並結案` });
    } else {
      const crmId = Array.isArray(order.fields?.CRM) ? order.fields.CRM[0] : '';
      if (crmId) await airtable(`${CRM}/${encodeURIComponent(crmId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ fields: { 'Next Follow-up': followupDate(3), 'Follow-up Note': '客戶要求再生成，需真人客服聯繫；3 天無回覆請追蹤，可手動結案' }, typecast: true }),
      });
      await airtable(`${ORDERS}/${encodeURIComponent(recordId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ fields: { 'Production Status': 'Review 審核中', 'Missing Assets Note': '真人客服待處理：客戶要求再生成，需聯繫客戶' }, typecast: true }),
      });
      await telegram('sendMessage', { chat_id: callback.message.chat.id,
        text: `已收到重新生成要求（${orderId}）。真人客服會直接與您聯繫，確認需求後重新製作。若暫時沒有回覆，客服會在 3 天後追蹤。` });
    }
    return res.status(200).json({ ok: true, action, recordId });
  } catch (error) {
    return res.status(500).json({ ok: false, error: String(error.message || error) });
  }
}
