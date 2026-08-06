# Telegram Order Conversation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a real Telegram conversation drawer to the admin order detail so staff can read and reply to customers without leaving the order workflow.

**Architecture:** Store message events as newline-delimited JSON entries appended to the existing CRM `Status History` field, preserving legacy status text. A dedicated Vercel API endpoint reads and writes conversations and sends staff replies through Telegram. The existing webhook records inbound events and successful bot replies without changing payment/order behavior.

**Tech Stack:** Vercel Node.js serverless functions, Airtable REST API, Telegram Bot API, single-file `admin.html` frontend.

## Global Constraints

- Reuse the existing CRM table and `Status History` field; do not add an Airtable table.
- Never expose `TELEGRAM_BOT_TOKEN` or `AIRTABLE_PAT` to the browser.
- Preserve existing manual processing, payment, and order-status controls.
- Escape server-provided message text before inserting it into HTML.

### Task 1: Conversation data helpers and API

**Files:**
- Create: `lib/telegram-conversation.mjs`
- Create: `api/telegram/conversation.js`
- Test: `tests/telegram-conversation.test.mjs`

- [ ] Add failing unit tests for parsing legacy status history, parsing JSONL messages, and appending a message without discarding existing text.
- [ ] Run `node --test tests/telegram-conversation.test.mjs`; confirm it fails because the helper is missing.
- [ ] Implement pure helpers `parseConversationHistory(value)`, `serializeConversationEntry(entry)`, and `appendConversationEntry(value, entry)`.
- [ ] Implement `GET /api/telegram/conversation?recordId=...` and `POST /api/telegram/conversation` with Airtable lookup, Telegram binding validation, `sendMessage`, and CRM append.
- [ ] Run the unit test and `node --check api/telegram/conversation.js`; confirm pass.

### Task 2: Webhook persistence

**Files:**
- Modify: `api/telegram/webhook.js`
- Test: `tests/telegram-webhook-persistence.test.mjs`

- [ ] Add a focused test for recording an incoming text event and a successful bot reply through the helper boundary.
- [ ] Run the test red before implementation.
- [ ] Resolve the CRM record by `/start` payload or Telegram user ID, set the request-local active CRM record, and append incoming text/photo/callback events.
- [ ] Wrap successful outgoing `sendMessage` calls so bot text replies are appended; logging failures must not fail the original webhook event.
- [ ] Run webhook syntax checks and the focused tests.

### Task 3: Standalone admin Telegram page

**Files:**
- Modify: `admin.html`

- [ ] Add a dedicated `admin-telegram` route with a left conversation list and right chat panel.
- [ ] Add a Telegram section and button to the order drawer that opens the standalone page using the CRM record ID.
- [ ] Render loading, empty, no-binding, error, and send states; escape message text and preserve the existing order controls.
- [ ] Run static checks and exercise the page against the deployed API path with mock/no-binding data.

### Task 4: Verification and delivery

**Files:**
- Modify: `api/crm/full.js` only if needed to expose conversation-compatible history.

- [ ] Run all available tests and syntax checks.
- [ ] Verify no secret names or tokens are sent in API JSON responses.
- [ ] Commit the feature, push `main`, deploy production, and verify the public site returns HTTP 200.
