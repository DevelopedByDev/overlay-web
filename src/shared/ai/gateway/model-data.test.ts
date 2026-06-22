import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getEnabledChatModels,
  registerGatewayCatalogModels,
} from './model-data'
import { byokConnectionsToChatModels } from './byok-model-conversion'

const DYNAMIC_MODEL_ID = 'example/new-premium-model'

test('new gateway models appear before the free section for paid users', () => {
  registerGatewayCatalogModels([{
    id: DYNAMIC_MODEL_ID,
    gatewayId: DYNAMIC_MODEL_ID,
    name: 'New Premium Model',
    type: 'language',
    provider: 'example',
    tags: [],
    pricing: {
      input: '0.0000003',
      output: '0.0000012',
    },
    inputPricePerMillion: 0.3,
    outputPricePerMillion: 1.2,
  }])

  const models = getEnabledChatModels([
    'openrouter/free',
    DYNAMIC_MODEL_ID,
  ], false)

  assert.deepEqual(models.map((model) => model.id), [
    DYNAMIC_MODEL_ID,
    'openrouter/free',
  ])
})

test('free models remain first for free-tier users', () => {
  const models = getEnabledChatModels([
    DYNAMIC_MODEL_ID,
    'openrouter/free',
  ], true)

  assert.deepEqual(models.map((model) => model.id), [
    'openrouter/free',
    DYNAMIC_MODEL_ID,
  ])
})

test('BYOK model conversion ignores non-array payloads', () => {
  assert.deepEqual(byokConnectionsToChatModels({ data: [] }), [])
})

test('BYOK model conversion falls back from slug ids to readable names', () => {
  const models = byokConnectionsToChatModels([{
    _id: 'custom-connection',
    providerId: 'custom',
    endpoint: 'https://zenmux.ai/api/v1',
    displayName: 'ZenMux',
    enabledModelIds: ['z-ai/glm-5.2-free'],
    discoveredModelsJson: JSON.stringify({
      data: [{ id: 'z-ai/glm-5.2-free', name: 'z-ai/glm-5.2-free' }],
    }),
    status: 'active',
    isDefault: false,
    isDeletable: true,
  }])

  assert.equal(models[0]?.name, 'GLM 5.2 Free')
  assert.equal(models[0]?.provider, 'ZenMux')
})

test('BYOK model conversion keeps real provider display names', () => {
  const models = byokConnectionsToChatModels([{
    _id: 'custom-connection',
    providerId: 'custom',
    endpoint: 'https://example.com/v1',
    displayName: 'Example',
    enabledModelIds: ['provider/model-slug'],
    discoveredModelsJson: JSON.stringify({
      data: [{ id: 'provider/model-slug', name: 'Human Model Name' }],
    }),
    status: 'active',
    isDefault: false,
    isDeletable: true,
  }])

  assert.equal(models[0]?.name, 'Human Model Name')
})

test('default Vercel AI Gateway row does not create BYOK duplicate models', () => {
  const models = byokConnectionsToChatModels([{
    _id: 'default-gateway-connection',
    providerId: 'vercel-ai-gateway',
    endpoint: 'https://ai-gateway.vercel.sh/v1',
    displayName: 'Vercel AI Gateway',
    enabledModelIds: ['gpt-5.4'],
    discoveredModelsJson: JSON.stringify({ data: [{ id: 'gpt-5.4', name: 'GPT 5.4' }] }),
    status: 'active',
    isDefault: true,
    isDeletable: false,
  }])

  assert.deepEqual(models, [])
})

test('user Vercel AI Gateway row creates BYOK models alongside hosted models', () => {
  const models = byokConnectionsToChatModels([{
    _id: 'user-gateway-connection',
    providerId: 'user-vercel-ai-gateway',
    endpoint: 'https://ai-gateway.vercel.sh/v1',
    displayName: 'User Vercel AI Gateway',
    enabledModelIds: ['openai/gpt-5.4'],
    discoveredModelsJson: JSON.stringify({ data: [{ id: 'openai/gpt-5.4', name: 'GPT 5.4' }] }),
    status: 'active',
    isDefault: false,
    isDeletable: true,
  }])

  assert.equal(models.length, 1)
  assert.equal(models[0]?.id, 'byok/user-gateway-connection/openai/gpt-5.4')
  assert.equal(models[0]?.name, 'GPT 5.4')
  assert.equal(models[0]?.provider, 'User Vercel AI Gateway')
})
