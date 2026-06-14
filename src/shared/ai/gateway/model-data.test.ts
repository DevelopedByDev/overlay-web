import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getEnabledChatModels,
  registerGatewayCatalogModels,
} from './model-data'

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
