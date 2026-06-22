import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DEFAULT_GATEWAY_PROVIDER_ID,
  assertByokRuntimeConnectionAllowed,
  byokEndpointMatchesPreset,
  normalizeByokEndpoint,
  resolveByokEndpointForCreate,
  resolveByokEndpointForPatch,
  type ByokRuntimeConnectionForSecurity,
} from './byok-security'

const activeOpenRouterConnection: ByokRuntimeConnectionForSecurity = {
  providerId: 'openrouter',
  endpoint: 'https://openrouter.ai/api/v1',
  enabledModelIds: ['anthropic/claude-sonnet-4.6'],
  isDefault: false,
  status: 'active',
}

test('normalizes endpoint trailing slashes for comparisons', () => {
  assert.equal(normalizeByokEndpoint(' https://openrouter.ai/api/v1/// '), 'https://openrouter.ai/api/v1')
  assert.equal(byokEndpointMatchesPreset('openrouter', 'https://openrouter.ai/api/v1/'), true)
})

test('create rejects managed default Vercel AI Gateway provider', () => {
  const result = resolveByokEndpointForCreate(DEFAULT_GATEWAY_PROVIDER_ID, 'https://ai-gateway.vercel.sh/v1')
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.equal(result.status, 403)
    assert.match(result.error, /managed automatically/)
  }
})

test('create rejects custom endpoints for preset-locked providers', () => {
  const result = resolveByokEndpointForCreate('openrouter', 'https://attacker.example/v1')
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.equal(result.status, 403)
    assert.match(result.error, /endpoint cannot be changed/)
  }
})

test('create allows preset-locked providers only at their default endpoint', () => {
  const result = resolveByokEndpointForCreate('openrouter', 'https://openrouter.ai/api/v1/')
  assert.deepEqual(result, { ok: true, endpoint: 'https://openrouter.ai/api/v1' })
})

test('create allows user Vercel AI Gateway at the locked Vercel endpoint', () => {
  const result = resolveByokEndpointForCreate('user-vercel-ai-gateway', undefined)
  assert.deepEqual(result, { ok: true, endpoint: 'https://ai-gateway.vercel.sh/v1' })
})

test('create rejects custom endpoints for user Vercel AI Gateway', () => {
  const result = resolveByokEndpointForCreate('user-vercel-ai-gateway', 'https://attacker.example/v1')
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.equal(result.status, 403)
    assert.match(result.error, /endpoint cannot be changed/)
  }
})

test('patch rejects endpoint mutation for preset-locked providers', () => {
  const result = resolveByokEndpointForPatch(DEFAULT_GATEWAY_PROVIDER_ID, 'https://attacker.example/v1')
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.equal(result.status, 403)
    assert.match(result.error, /endpoint cannot be changed/)
  }
})

test('patch rejects endpoint mutation for default rows even when a provider supports custom endpoints', () => {
  const result = resolveByokEndpointForPatch('custom', 'https://models.example.com/v1', { isDefault: true })
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.equal(result.status, 403)
    assert.match(result.error, /endpoint cannot be changed/)
  }
})

test('patch accepts custom provider endpoint updates', () => {
  const result = resolveByokEndpointForPatch('custom', 'https://models.example.com/v1')
  assert.deepEqual(result, { ok: true, endpoint: 'https://models.example.com/v1' })
})

test('runtime rejects hosted default gateway BYOK model ids', () => {
  assert.throws(
    () => assertByokRuntimeConnectionAllowed({
      providerId: DEFAULT_GATEWAY_PROVIDER_ID,
      endpoint: 'https://ai-gateway.vercel.sh/v1',
      enabledModelIds: ['openai/gpt-5.4'],
      isDefault: true,
      status: 'active',
    }, 'openai/gpt-5.4'),
    /default Vercel AI Gateway connection cannot be used through BYOK/,
  )
})

test('runtime rejects disabled raw model ids', () => {
  assert.throws(
    () => assertByokRuntimeConnectionAllowed(activeOpenRouterConnection, 'openai/gpt-5.4'),
    /not enabled/,
  )
})

test('runtime rejects inactive provider connections', () => {
  assert.throws(
    () => assertByokRuntimeConnectionAllowed({
      ...activeOpenRouterConnection,
      status: 'untested',
    }, 'anthropic/claude-sonnet-4.6'),
    /not active/,
  )
})

test('runtime rejects preset providers stored with a non-default endpoint', () => {
  assert.throws(
    () => assertByokRuntimeConnectionAllowed({
      ...activeOpenRouterConnection,
      endpoint: 'https://attacker.example/v1',
    }, 'anthropic/claude-sonnet-4.6'),
    /does not match the locked provider endpoint/,
  )
})

test('runtime allows active custom provider enabled models', () => {
  assert.doesNotThrow(() => assertByokRuntimeConnectionAllowed({
    providerId: 'custom',
    endpoint: 'https://models.example.com/v1',
    enabledModelIds: ['z-ai/glm-5.2'],
    isDefault: false,
    status: 'active',
  }, 'z-ai/glm-5.2'))
})

test('runtime allows active user Vercel AI Gateway enabled models at the locked endpoint', () => {
  assert.doesNotThrow(() => assertByokRuntimeConnectionAllowed({
    providerId: 'user-vercel-ai-gateway',
    endpoint: 'https://ai-gateway.vercel.sh/v1',
    enabledModelIds: ['openai/gpt-5.4'],
    isDefault: false,
    status: 'active',
  }, 'openai/gpt-5.4'))
})

test('runtime rejects user Vercel AI Gateway models at non-Vercel endpoints', () => {
  assert.throws(
    () => assertByokRuntimeConnectionAllowed({
      providerId: 'user-vercel-ai-gateway',
      endpoint: 'https://attacker.example/v1',
      enabledModelIds: ['openai/gpt-5.4'],
      isDefault: false,
      status: 'active',
    }, 'openai/gpt-5.4'),
    /does not match the locked provider endpoint/,
  )
})
