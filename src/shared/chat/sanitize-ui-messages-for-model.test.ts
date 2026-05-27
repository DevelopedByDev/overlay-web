import test from 'node:test'
import assert from 'node:assert/strict'
import { sanitizeUiMessagesForModelApi } from './sanitize-ui-messages-for-model'
import type { UIMessage } from 'ai'

test('drops json-render data parts from future model messages', () => {
  const messages = [
    {
      id: 'assistant-1',
      role: 'assistant',
      parts: [
        {
          type: 'data',
          id: 'part-1',
          dataType: 'json-render',
          data: {
            schemaVersion: 1,
            spec: { root: 'card', elements: {} },
            actions: [{ id: 'send-email', kind: 'gmail.sendEmail' }],
          },
        },
        { type: 'text', text: 'Please review the email card.' },
      ],
    },
  ] as unknown as UIMessage[]

  assert.deepEqual(sanitizeUiMessagesForModelApi(messages), [
    {
      id: 'assistant-1',
      role: 'assistant',
      parts: [{ type: 'text', text: 'Please review the email card.' }],
    },
  ])
})

test('drops render_ui tool payload summaries from future model messages', () => {
  const messages = [
    {
      id: 'assistant-1',
      role: 'assistant',
      parts: [
        {
          type: 'tool-invocation',
          toolInvocation: {
            toolName: 'render_ui',
            state: 'output-available',
            toolInput: { spec: { root: 'card', elements: {} } },
            toolOutput: {
              rendered: true,
              spec: { root: 'card', elements: {} },
              actions: [{ id: 'send-email', kind: 'gmail.sendEmail' }],
            },
          },
        },
      ],
    },
  ] as unknown as UIMessage[]

  assert.deepEqual(sanitizeUiMessagesForModelApi(messages), [])
})
