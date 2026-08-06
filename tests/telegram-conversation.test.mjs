import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseConversationHistory,
  appendConversationEntry,
  serializeConversationEntry,
} from '../lib/telegram-conversation.mjs';

test('parses legacy status history as readable system entries', () => {
  const entries = parseConversationHistory('2026-08-06 · New · Admin 後台\n人工備註');
  assert.equal(entries.length, 2);
  assert.equal(entries[0].role, 'system');
  assert.equal(entries[0].text, '2026-08-06 · New · Admin 後台');
});

test('parses JSONL conversation messages', () => {
  const value = [
    { id: 'm1', at: '2026-08-06T01:00:00.000Z', role: 'customer', kind: 'text', text: '你好' },
    { id: 'm2', at: '2026-08-06T01:01:00.000Z', role: 'bot', kind: 'text', text: '您好' },
  ].map(serializeConversationEntry).join('\n');
  assert.deepEqual(parseConversationHistory(value).map(entry => entry.id), ['m1', 'm2']);
});

test('appends a conversation entry without replacing legacy history', () => {
  const value = appendConversationEntry('原有狀態紀錄', {
    id: 'm3', at: '2026-08-06T01:02:00.000Z', role: 'agent', kind: 'text', text: '我來協助你',
  });
  assert.match(value, /^原有狀態紀錄\n/);
  assert.equal(parseConversationHistory(value).at(-1).text, '我來協助你');
});
