import assert from 'node:assert/strict'
import test from 'node:test'
import { shouldAutoContinueAssistantResponse } from './continuation'

test('auto-continue only triggers for completed timeout sentinel messages', () => {
  assert.equal(
    shouldAutoContinueAssistantResponse({
      messageId: 'm1',
      status: 'completed',
      text: 'Work paused.\n\n[Request timed out after 60s. Continue?]',
    }),
    true,
  )
  assert.equal(
    shouldAutoContinueAssistantResponse({
      messageId: 'm1',
      status: 'generating',
      text: '[Request timed out after 60s. Continue?]',
    }),
    false,
  )
  assert.equal(
    shouldAutoContinueAssistantResponse({
      messageId: null,
      status: 'completed',
      text: '[Request timed out after 60s. Continue?]',
    }),
    false,
  )
})

test('auto-continue skips messages already handled', () => {
  assert.equal(
    shouldAutoContinueAssistantResponse({
      messageId: 'm1',
      status: 'completed',
      text: '[Request timed out after 30s. Continue?]',
      seenMessageIds: new Set(['m1']),
    }),
    false,
  )
})
