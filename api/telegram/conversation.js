import { appendConversationEntry, parseConversationHistory } from '../../lib/telegram-conversation.mjs';

const BASE = 'appOLY56Y7cNExxzs';
const CRM = 'tblWtB7qlAQQTYS9v';
const AIRTABLE_API = `https://api.airtable.com/v0/${BASE}`;

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
  return {
    recordId: record.id,
    crmId: fields['CRM ID'] || '',
    customerName: fields['Customer Name'] || '未命名客戶',
    telegramUserId: fields['Telegram User ID'] ? String(fields['Telegram User ID']) : '',
    telegramUsername: fields['Telegram Username'] || '',
    status: fields['CRM Status'] || '',
    updatedAt: fields['Last Updated'] || '',
    messages,
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

  const recordId = String(req.query?.recordId || req.body?.recordId || '').trim();
  if (!recordId) return jsonError(res, 400, 'recordId is required');

  try {
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
