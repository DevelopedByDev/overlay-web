import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildChatActionIdempotencyKey,
  buildComposioGmailSendArguments,
  normalizeGmailSendValues,
  parseEmailList,
  type GmailSendActionDescriptor,
} from './gmail-send'

const action: GmailSendActionDescriptor = {
  id: 'send-email',
  kind: 'gmail.sendEmail',
  fieldMap: {
    recipientEmail: 'to',
    subject: 'subject',
    body: 'body',
    cc: 'cc',
    bcc: 'bcc',
  },
}

test('normalizes Gmail send values into plaintext Composio arguments', () => {
  const normalized = normalizeGmailSendValues(action, {
    to: ' ada@example.com ',
    subject: ' Hello ',
    body: ' Plain text body ',
    cc: 'one@example.com; two@example.com',
    bcc: 'hidden@example.com, other@example.com',
  })

  assert.deepEqual(normalized, {
    recipientEmail: 'ada@example.com',
    subject: 'Hello',
    body: 'Plain text body',
    cc: ['one@example.com', 'two@example.com'],
    bcc: ['hidden@example.com', 'other@example.com'],
  })
  assert.deepEqual(buildComposioGmailSendArguments(normalized), {
    recipient_email: 'ada@example.com',
    subject: 'Hello',
    body: 'Plain text body',
    cc: ['one@example.com', 'two@example.com'],
    bcc: ['hidden@example.com', 'other@example.com'],
    is_html: false,
  })
})

test('requires recipient, subject, and body', () => {
  assert.throws(() => normalizeGmailSendValues(action, { subject: 'S', body: 'B' }), /Recipient is required/)
  assert.throws(() => normalizeGmailSendValues(action, { to: 'a@example.com', body: 'B' }), /Subject is required/)
  assert.throws(() => normalizeGmailSendValues(action, { to: 'a@example.com', subject: 'S' }), /Body is required/)
})

test('parses cc and bcc lists on commas and semicolons', () => {
  assert.deepEqual(parseEmailList('a@example.com, b@example.com; c@example.com'), [
    'a@example.com',
    'b@example.com',
    'c@example.com',
  ])
})

test('idempotency key is stable for the same normalized send input', () => {
  const normalized = normalizeGmailSendValues(action, {
    to: 'ada@example.com',
    subject: 'Hello',
    body: 'Plain text body',
  })
  const first = buildChatActionIdempotencyKey({
    userId: 'user_1',
    conversationId: 'conv_1',
    assistantMessageId: 'msg_1',
    dataPartId: 'part_1',
    actionId: 'send-email',
    normalizedInput: normalized,
  })
  const second = buildChatActionIdempotencyKey({
    userId: 'user_1',
    conversationId: 'conv_1',
    assistantMessageId: 'msg_1',
    dataPartId: 'part_1',
    actionId: 'send-email',
    normalizedInput: normalized,
  })
  assert.equal(first.idempotencyKey, second.idempotencyKey)
  assert.equal(first.inputHash, second.inputHash)
})
