import { createHash } from 'node:crypto';

function legacyId(text) {
  return `legacy-${createHash('sha1').update(String(text)).digest('hex').slice(0, 12)}`;
}

function normalizeEntry(entry) {
  const text = String(entry?.text ?? '').trim();
  if (!text) return null;
  return {
    id: String(entry.id || legacyId(text)),
    at: entry.at ? String(entry.at) : null,
    role: ['customer', 'agent', 'bot', 'system'].includes(entry.role) ? entry.role : 'system',
    kind: ['text', 'photo', 'callback', 'system', 'history'].includes(entry.kind) ? entry.kind : 'history',
    text,
    telegramMessageId: entry.telegramMessageId ? String(entry.telegramMessageId) : null,
  };
}

export function parseConversationHistory(value) {
  const raw = String(value || '').trim();
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(normalizeEntry).filter(Boolean);
    if (parsed && typeof parsed === 'object') {
      const entry = normalizeEntry(parsed);
      if (entry) return [entry];
    }
  } catch (_) {
    // Existing Status History is normally plain text or JSONL; parse line by line below.
  }

  return raw.split(/\r?\n/).map(line => {
    const text = line.trim();
    if (!text) return null;
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === 'object') return normalizeEntry(parsed);
    } catch (_) {
      // Legacy status line.
    }
    return normalizeEntry({ id: legacyId(text), role: 'system', kind: 'history', text });
  }).filter(Boolean);
}

export function serializeConversationEntry(entry) {
  const normalized = normalizeEntry(entry);
  if (!normalized) throw new Error('Conversation entry text is required');
  return JSON.stringify(normalized);
}

export function appendConversationEntry(value, entry) {
  const existing = String(value || '').trim();
  const serialized = serializeConversationEntry(entry);
  return existing ? `${existing}\n${serialized}` : serialized;
}
