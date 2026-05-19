import test from 'node:test'
import assert from 'node:assert/strict'
// @ts-expect-error Node's strip-types test runner loads the adjacent TS module directly.
import { validatePublicNetworkUrl } from './ssrf.ts'

test('validatePublicNetworkUrl blocks localhost in production-style validation', async () => {
  const result = await validatePublicNetworkUrl('https://localhost:3333/mcp', {
    allowLocalDev: false,
    requireHttps: true,
  })
  assert.equal(result.ok, false)
})

test('validatePublicNetworkUrl rejects private IP literals', async () => {
  const result = await validatePublicNetworkUrl('https://10.0.0.5/mcp', {
    allowLocalDev: false,
    requireHttps: true,
  })
  assert.equal(result.ok, false)
})

test('validatePublicNetworkUrl allows localhost only in development when requested', async () => {
  const originalNodeEnv = process.env.NODE_ENV
  ;(process.env as Record<string, string | undefined>).NODE_ENV = 'development'
  try {
    const result = await validatePublicNetworkUrl('http://localhost:3333/mcp', {
      allowLocalDev: true,
      requireHttps: true,
    })
    assert.equal(result.ok, true)
  } finally {
    ;(process.env as Record<string, string | undefined>).NODE_ENV = originalNodeEnv
  }
})
