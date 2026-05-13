import assert from 'node:assert/strict'
import test from 'node:test'

import { AVAILABLE_MODELS, IMAGE_MODELS, VIDEO_MODELS } from './model-data'
import {
  calculateEmbeddingCostOrNull,
  calculateImageCostOrNull,
  calculateTokenCost,
  calculateTokenCostOrNull,
  calculateVideoCostOrNull,
  estimateTokenCost,
  getPricingSnapshotMetadata,
  isExplicitFreeModel,
  isPremiumModel,
  isPricedLanguageModel,
} from './model-pricing'

const HELPER_LANGUAGE_MODELS = [
  'nvidia/nemotron-nano-9b-v2',
  'openai/gpt-oss-20b',
  'google/gemini-2.5-flash-lite',
] as const

const EMBEDDING_MODELS = ['openai/text-embedding-3-small'] as const

test('generated pricing snapshot is present', () => {
  const metadata = getPricingSnapshotMetadata()
  assert.equal(metadata.source, 'https://ai-gateway.vercel.sh/v1/models')
  assert.match(metadata.generatedAt, /^\d{4}-\d{2}-\d{2}T/)
})

test('missing pricing fails closed instead of returning zero', () => {
  assert.equal(calculateTokenCostOrNull('unknown/provider-model', 1000, 0, 1000), null)
  assert.equal(calculateImageCostOrNull('unknown/image-model'), null)
  assert.equal(calculateVideoCostOrNull('unknown/video-model', 8), null)
  assert.throws(() => calculateTokenCost('unknown/provider-model', 1000, 0, 1000), /pricing/i)
})

test('paid models cannot be misclassified as free', () => {
  assert.equal(isPremiumModel('qwen/qwen3.6-plus'), true)
  assert.equal(isExplicitFreeModel('qwen/qwen3.6-plus'), false)
  assert.ok((calculateTokenCostOrNull('qwen/qwen3.6-plus', 1000, 0, 1000) ?? 0) > 0)
  assert.ok((calculateTokenCostOrNull('anthropic/claude-opus-4.7', 1000, 0, 1000) ?? 0) > 0)
})

test('tiered and cached-token pricing are nonzero when the snapshot provides them', () => {
  const uncached = calculateTokenCostOrNull('alibaba/qwen3.6-plus', 300_000, 0, 1_000)
  const cached = calculateTokenCostOrNull('alibaba/qwen3.6-plus', 300_000, 300_000, 1_000)
  assert.ok(uncached !== null && uncached > 0)
  assert.ok(cached !== null && cached > 0)
  assert.ok(cached < uncached)
})

test('image, video, and embedding provider spend is priced', () => {
  assert.ok((calculateImageCostOrNull('bytedance/seedream-4.5') ?? 0) > 0)
  assert.ok((calculateImageCostOrNull('openai/gpt-image-1.5') ?? 0) > 0)
  assert.ok((calculateVideoCostOrNull('google/veo-3.1-generate-001', 8) ?? 0) > 0)
  assert.ok((calculateVideoCostOrNull('klingai/kling-v2.6-t2v', 5) ?? 0) > 0)
  assert.ok((calculateEmbeddingCostOrNull('openai/text-embedding-3-small', 1000) ?? 0) > 0)
})

test('all callable chat/helper/background models have explicit free or paid pricing', () => {
  for (const model of AVAILABLE_MODELS) {
    assert.equal(
      isExplicitFreeModel(model.id) || isPricedLanguageModel(model.id),
      true,
      `${model.id} must be explicit-free or priced`,
    )
  }

  for (const modelId of HELPER_LANGUAGE_MODELS) {
    const estimate = estimateTokenCost(modelId, 1000, 0, 1000)
    assert.ok(estimate && estimate.providerCostUsd > 0, `${modelId} must have paid helper pricing`)
  }
})

test('all media and embedding models used by the app are priced', () => {
  for (const model of IMAGE_MODELS) {
    assert.ok((calculateImageCostOrNull(model.id) ?? 0) > 0, `${model.id} image pricing missing`)
  }

  for (const model of VIDEO_MODELS) {
    assert.ok((calculateVideoCostOrNull(model.id, model.defaultDuration ?? 8) ?? 0) > 0, `${model.id} video pricing missing`)
  }

  for (const modelId of EMBEDDING_MODELS) {
    assert.ok((calculateEmbeddingCostOrNull(modelId, 1000) ?? 0) > 0, `${modelId} embedding pricing missing`)
  }
})
