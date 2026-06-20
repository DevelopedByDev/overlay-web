import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ChatTransportHttpError,
  createChatDiagnosticFetch,
  resolvePersistentChatStreamMode,
} from './cloudflare-chat-transport'

test('defaults persistent sends to cloudflare mirror mode', () => {
  assert.equal(resolvePersistentChatStreamMode({
    conversationId: 'conversation-123',
    turnId: 'turn-123',
  }), 'cloudflare-mirror')
  assert.equal(resolvePersistentChatStreamMode({
    conversationClientId: 'client-123',
    turnId: 'turn-123',
  }), 'cloudflare-mirror')
  assert.equal(resolvePersistentChatStreamMode({
    temporaryChat: true,
    turnId: 'turn-123',
  }), 'direct')
  assert.equal(resolvePersistentChatStreamMode({
    conversationId: 'conversation-123',
    streamPersistenceMode: 'direct',
    turnId: 'turn-123',
  }), 'direct')
})

test('preserves structured relay error details for browser diagnostics', async () => {
  const originalConsoleError = console.error
  console.error = () => {}
  try {
    const diagnosticFetch = createChatDiagnosticFetch(async () => new Response(JSON.stringify({
      code: 'relay_upstream_failed',
      error: 'Provider rejected the request',
      fallbackSafe: false,
      phase: 'upstream',
      requestId: 'request-456',
    }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    }))

    await assert.rejects(
      diagnosticFetch('/api/v1/conversations/act', {
        headers: { 'x-request-id': 'request-456' },
      }),
      (error: unknown) => {
        assert.ok(error instanceof ChatTransportHttpError)
        assert.equal(error.status, 502)
        assert.equal(error.phase, 'upstream')
        assert.equal(error.fallbackSafe, false)
        assert.equal(error.requestId, 'request-456')
        assert.equal(error.message, 'Provider rejected the request')
        return true
      },
    )
  } finally {
    console.error = originalConsoleError
  }
})
