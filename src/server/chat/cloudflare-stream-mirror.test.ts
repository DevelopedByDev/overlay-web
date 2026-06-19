import assert from 'node:assert/strict'
import test from 'node:test'
import type { NextRequest } from 'next/server'
import {
  canMirrorToCloudflareStream,
  resolveCloudflareStreamMirrorUrl,
} from './cloudflare-stream-mirror'

function requestFor(origin: string): NextRequest {
  return { nextUrl: new URL(origin) } as NextRequest
}

function withEnv<T>(env: NodeJS.ProcessEnv, run: () => T): T {
  const previous = { ...process.env }
  process.env = { ...previous, ...env }
  try {
    return run()
  } finally {
    process.env = previous
  }
}

test('resolveCloudflareStreamMirrorUrl appends ingest to same-origin relay paths', () => {
  withEnv({
    NODE_ENV: 'production',
    NEXT_PUBLIC_CHAT_STREAM_RELAY_URL: '/api/chat-stream/v1/streams',
    CHAT_STREAM_RELAY_SECRET: 'secret',
  }, () => {
    const url = resolveCloudflareStreamMirrorUrl(requestFor('https://www.getoverlay.io/app/chat'))
    assert.equal(url?.toString(), 'https://www.getoverlay.io/api/chat-stream/v1/streams/ingest')
    assert.equal(canMirrorToCloudflareStream(requestFor('https://www.getoverlay.io/app/chat')), true)
  })
})

test('resolveCloudflareStreamMirrorUrl honors local relay gating in development', () => {
  withEnv({
    NODE_ENV: 'development',
    NEXT_PUBLIC_CHAT_STREAM_RELAY_URL: '/api/chat-stream/v1/streams',
    NEXT_PUBLIC_CHAT_STREAM_RELAY_LOCAL: '',
    CHAT_STREAM_RELAY_SECRET: 'secret',
  }, () => {
    assert.equal(resolveCloudflareStreamMirrorUrl(requestFor('http://localhost:3000/app/chat')), null)
    assert.equal(canMirrorToCloudflareStream(requestFor('http://localhost:3000/app/chat')), false)
  })

  withEnv({
    NODE_ENV: 'development',
    NEXT_PUBLIC_CHAT_STREAM_RELAY_URL: '/api/chat-stream/v1/streams',
    NEXT_PUBLIC_CHAT_STREAM_RELAY_LOCAL: 'true',
    CHAT_STREAM_RELAY_SECRET: 'secret',
  }, () => {
    const url = resolveCloudflareStreamMirrorUrl(requestFor('http://localhost:3000/app/chat'))
    assert.equal(url?.toString(), 'http://localhost:3000/api/chat-stream/v1/streams/ingest')
  })
})
