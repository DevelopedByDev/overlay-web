import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getCapabilityDisabledError,
  getRequiredCapabilityForRoute,
} from './capabilities-core'

test('getRequiredCapabilityForRoute maps owned capability routes', () => {
  assert.equal(getRequiredCapabilityForRoute('GET', '/api/v1/subscription'), 'billing')
  assert.equal(getRequiredCapabilityForRoute('GET', '/api/v1/subscription/settings'), 'billing')
  assert.equal(getRequiredCapabilityForRoute('GET', '/api/v1/webhooks'), 'webhooks')
  assert.equal(getRequiredCapabilityForRoute('GET', '/api/v1/api-keys'), 'apiKeys')
  assert.equal(getRequiredCapabilityForRoute('POST', '/api/v1/automations/run'), 'automations')
  assert.equal(getRequiredCapabilityForRoute('POST', '/api/v1/knowledge/search'), 'vectorSearch')
  assert.equal(getRequiredCapabilityForRoute('GET', '/api/v1/memory'), 'vectorSearch')
  assert.equal(getRequiredCapabilityForRoute('PATCH', '/api/v1/memory/mem_123'), 'vectorSearch')
})

test('getRequiredCapabilityForRoute preserves basic file listing routes', () => {
  assert.equal(getRequiredCapabilityForRoute('GET', '/api/v1/files'), null)
  assert.equal(getRequiredCapabilityForRoute('GET', '/api/v1/files/file_123/content'), null)
  assert.equal(getRequiredCapabilityForRoute('POST', '/api/v1/files/search-text'), null)
})

test('getCapabilityDisabledError returns deterministic error payloads', () => {
  assert.deepEqual(getCapabilityDisabledError('billing'), {
    error: 'Billing is disabled for this deployment.',
    code: 'capability_disabled',
    capability: 'billing',
  })
  assert.deepEqual(getCapabilityDisabledError('apiKeys'), {
    error: 'API key management is disabled for this deployment.',
    code: 'capability_disabled',
    capability: 'apiKeys',
  })
})
