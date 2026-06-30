import assert from 'node:assert/strict'
import test from 'node:test'
import { validateApiClientBoundary } from './api-boundary'

test('automation run boundary accepts Convex scheduled runner payloads', () => {
  assert.doesNotThrow(() => {
    validateApiClientBoundary({
      path: '/api/v1/automations/run',
      method: 'POST',
      body: { runId: 'run_1' },
    })
  })
})

test('automation run boundary rejects missing run IDs', () => {
  assert.throws(
    () => {
      validateApiClientBoundary({
        path: '/api/v1/automations/run',
        method: 'POST',
        body: {},
      })
    },
    /Invalid POST \/api\/v1\/automations\/run body: Required/,
  )
})
