import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ChatTransportHttpError,
  createChatDiagnosticFetch,
  shouldBypassChatStreamRelay,
  shouldFallbackAfterRelayError,
} from './cloudflare-chat-transport'

test('bypasses the relay while a first chat only has a client ID', () => {
  assert.equal(shouldBypassChatStreamRelay({
    conversationClientId: 'client-123',
    turnId: 'turn-123',
  }), true)
})

test('uses the relay once the conversation has a persisted ID', () => {
  assert.equal(shouldBypassChatStreamRelay({
    conversationId: 'conversation-123',
    conversationClientId: 'client-123',
    turnId: 'turn-123',
  }), false)
})

test('does not bypass ordinary persisted turns', () => {
  assert.equal(shouldBypassChatStreamRelay({
    conversationId: 'conversation-123',
    turnId: 'turn-123',
  }), false)
})

test('only falls back when the relay explicitly says the upstream was not started', () => {
  assert.equal(shouldFallbackAfterRelayError(new ChatTransportHttpError({
    endpoint: '/api/chat-stream/v1/streams/start',
    fallbackSafe: true,
    message: 'Relay authorization failed',
    phase: 'authorization',
    requestId: 'request-123',
    status: 401,
  })), true)
  assert.equal(shouldFallbackAfterRelayError(new ChatTransportHttpError({
    endpoint: '/api/chat-stream/v1/streams/start',
    fallbackSafe: false,
    message: 'Provider request failed',
    phase: 'upstream',
    requestId: 'request-123',
    status: 502,
  })), false)
  assert.equal(shouldFallbackAfterRelayError(new Error('network disconnected')), false)
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
      diagnosticFetch('/api/chat-stream/v1/streams/start', {
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
