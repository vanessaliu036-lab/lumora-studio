const BASE = 'appOLY56Y7cNExxzs';
const CRM = 'tblWtB7qlAQQTYS9v';
const AIRTABLE_API = `https://api.airtable.com/v0/${BASE}`;

function normalizeConversationEntry(entry) {
  const text = String(entry?.text || '').trim();
  if (!text) return null;
  return {
    id: String(entry.id || `history-${text.length}-${text.slice(0, 12)}`),
    at: entry.at ? String(entry.at) : null,
    role: ['customer', 'agent', 'bot', 'system'].includes(entry.role) ? entry.role : 'system',
    kind: ['text', 'photo', 'callback', 'system', 'history'].includes(entry.kind) ? entry.kind : 'history',
    text,
    telegramMessageId: entry.telegramMessageId ? String(entry.telegramMessageId) : null,
  };
}

function parseConversationHistory(value) {
  const raw = String(value || '').trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(normalizeConversationEntry).filter(Boolean);
    if (parsed && typeof parsed === 'object') return [normalizeConversationEntry(parsed)].filter(Boolean);
  } catch (_) {}
  return raw.split(/\r?\n/).map(line => {
    const text = line.trim();
    if (!text) return null;
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === 'object') return normalizeConversationEntry(parsed);
    } catch (_) {}
    return normalizeConversationEntry({ role: 'system', kind: 'history', text });
  }).filter(Boolean);
}

function appendConversationEntry(value, entry) {
  const existing = String(value || '').trim();
  const serialized = JSON.stringify(normalizeConversationEntry(entry));
  return existing ? `${existing}\n${serialized}` : serialized;
}

function jsonError(res, status, error) {
  return res.status(status).json({ ok: false, error });
}

async function airtableRecord(recordId, options = {}) {
  const response = await fetch(`${AIRTABLE_API}/${CRM}/${encodeURIComponent(recordId)}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${process.env.AIRTABLE_PAT}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message || `Airtable request failed: ${response.status}`);
  return payload;
}

async function airtableList() {
  const response = await fetch(`${AIRTABLE_API}/${CRM}?pageSize=100`, {
    headers: { Authorization: `Bearer ${process.env.AIRTABLE_PAT}` },
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message || `Airtable request failed: ${response.status}`);
  return payload.records || [];
}

async function sendTelegramMessage(chatId, text) {
  const response = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  const payload = await response.json();
  if (!response.ok || !payload.ok) throw new Error(payload?.description || `Telegram request failed: ${response.status}`);
  return payload.result;
}

function recordView(record) {
  const fields = record.fields || {};
  const messages = parseConversationHistory(fields['Status History']);
  const telegramUserId = fields['Telegram User ID'] ? String(fields['Telegram User ID']) : '';
  const rawName = fields['Customer Name'] || '';
  const sourceText = `${rawName} ${fields['Inquiry Summary'] || ''} ${fields['Follow-up Note'] || ''}`;
  const isFixture = /test|e2e|mock|demo/i.test(sourceText);
  return {
    recordId: record.id,
    crmId: fields['CRM ID'] || '',
    customerName: rawName || `Telegram ${fields['Telegram Username'] || telegramUserId || '對話'}`,
    telegramUserId,
    telegramUsername: fields['Telegram Username'] || '',
    status: fields['CRM Status'] || '',
    inquiryDate: fields['Inquiry Date'] || '',
    updatedAt: fields['Last Updated'] || '',
    messages: messages.filter(message => message.role !== 'system' || message.kind !== 'history'),
    isFixture,
    canReply: Boolean(fields['Telegram User ID']),
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!process.env.AIRTABLE_PAT) return jsonError(res, 500, 'AIRTABLE_PAT is not configured');
  if (!process.env.TELEGRAM_BOT_TOKEN) return jsonError(res, 500, 'TELEGRAM_BOT_TOKEN is not configured');

  try {
    if (req.method === 'GET' && String(req.query?.list || '') === '1') {
      const records = await airtableList();
      const views = records.map(recordView);
      const preferredNameByUser = new Map();
      views.filter(conversation => conversation.telegramUserId && conversation.customerName && !conversation.isFixture)
        .sort((a, b) => String(b.inquiryDate || '').localeCompare(String(a.inquiryDate || '')))
        .forEach(conversation => {
          if (!preferredNameByUser.has(conversation.telegramUserId)) preferredNameByUser.set(conversation.telegramUserId, conversation.customerName);
        });
      const groupedByUser = new Map();
      views
        .filter(conversation => conversation.telegramUserId && conversation.messages.length)
        .forEach(conversation => {
          const previous = groupedByUser.get(conversation.telegramUserId);
          if (!previous) {
            groupedByUser.set(conversation.telegramUserId, { ...conversation, messages: [...conversation.messages] });
            return;
          }
          const messages = [...previous.messages, ...conversation.messages]
            .sort((a, b) => String(a.at || '').localeCompare(String(b.at || '')))
            .filter((message, index, all) => index === all.findIndex(item => item.id === message.id));
          const currentIsBetterName = previous.isFixture && !conversation.isFixture;
          const newestRecord = String(conversation.inquiryDate || '') >= String(previous.inquiryDate || '') ? conversation : previous;
          groupedByUser.set(conversation.telegramUserId, {
            ...newestRecord,
            customerName: preferredNameByUser.get(conversation.telegramUserId) || (currentIsBetterName ? conversation.customerName : previous.customerName),
            messages,
          });
        });
      return res.status(200).json({ ok: true, conversations: [...groupedByUser.values()] });
    }
    const recordId = String(req.query?.recordId || req.body?.recordId || '').trim();
    if (!recordId) return jsonError(res, 400, 'recordId is required');
    const record = await airtableRecord(recordId);
    if (req.method === 'GET') return res.status(200).json({ ok: true, conversation: recordView(record) });
    if (req.method !== 'POST') return jsonError(res, 405, 'Method not allowed');

    const text = String(req.body?.text || '').trim();
    if (!text) return jsonError(res, 400, 'text is required');
    if (text.length > 4096) return jsonError(res, 400, 'text must be 4096 characters or fewer');
    const fields = record.fields || {};
    const telegramUserId = String(fields['Telegram User ID'] || '').trim();
    if (!telegramUserId) return jsonError(res, 409, 'This CRM record has no Telegram User ID');

    const sent = await sendTelegramMessage(telegramUserId, text);
    const entry = {
      id: `agent-${sent.message_id}-${Date.now()}`,
      at: new Date().toISOString(),
      role: 'agent',
      kind: 'text',
      text,
      telegramMessageId: String(sent.message_id || ''),
    };
    const history = appendConversationEntry(fields['Status History'], entry);
    const updated = await airtableRecord(recordId, {
      method: 'PATCH',
      body: JSON.stringify({ fields: { 'Status History': history }, typecast: true }),
    });
    return res.status(200).json({ ok: true, message: entry, conversation: recordView(updated) });
  } catch (error) {
    return jsonError(res, 500, String(error.message || error));
  }
}
