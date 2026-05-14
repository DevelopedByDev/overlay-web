import assert from 'node:assert/strict'
import test from 'node:test'

import { AVAILABLE_MODELS, modelSupportsZeroDataRetention } from './model-data'
import { isFreeTierChatModelId } from './model-types'

test('known Gateway-backed ZDR models report support', () => {
  assert.equal(modelSupportsZeroDataRetention('anthropic/claude-opus-4.7'), true)
  assert.equal(modelSupportsZeroDataRetention('claude-sonnet-4-6'), true)
  assert.equal(modelSupportsZeroDataRetention('gemini-3.1-pro-preview'), true)
  assert.equal(modelSupportsZeroDataRetention('openai/gpt-oss-120b'), true)
})

test('non-ZDR and non-Gateway models report no support', () => {
  assert.equal(modelSupportsZeroDataRetention('gpt-5.4'), false)
  assert.equal(modelSupportsZeroDataRetention('xai/grok-4.20-reasoning'), false)
  assert.equal(modelSupportsZeroDataRetention('z-ai/glm-5.1'), false)
  assert.equal(modelSupportsZeroDataRetention('qwen/qwen3.6-plus'), false)
  assert.equal(modelSupportsZeroDataRetention('stepfun-ai/step-3.5-flash'), false)
  assert.equal(modelSupportsZeroDataRetention('missing/model'), false)
})

test('free chat models never report ZDR support', () => {
  for (const model of AVAILABLE_MODELS.filter((m) => isFreeTierChatModelId(m.id))) {
    assert.equal(model.supportsZeroDataRetention, false, `${model.id} must not support ZDR`)
  }
})
