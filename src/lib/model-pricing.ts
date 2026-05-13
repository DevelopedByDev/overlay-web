/**
 * Provider pricing helpers.
 *
 * Provider spend must fail closed. Unknown model ids and model ids without
 * usable pricing return null from the `*OrNull` helpers and throw from the
 * legacy `calculate*` helpers.
 */

import { VERCEL_AI_GATEWAY_PRICING_SNAPSHOT } from './generated/vercel-ai-gateway-pricing'
import { isFreeTierChatModelId } from './model-types'

export type GatewayPricingTier = {
  cost: string | number
  min?: number
  max?: number
}

export type GatewayVideoDurationPrice = {
  cost_per_second?: string | number
  resolution?: string
  mode?: string
  audio?: boolean
}

export type GatewayPricingSnapshot = {
  generatedAt: string
  source: string
  models: Record<string, GatewayModelPricing>
}

export type GatewayModelPricing = {
  id: string
  name: string
  type: string
  contextWindow: number | null
  maxTokens: number | null
  tags: readonly string[]
  pricing: Record<string, unknown>
}

export type ProviderCostEstimate = {
  providerCostUsd: number
  pricingModelId: string
  pricingSource: 'gateway-snapshot' | 'manual-override' | 'explicit-free'
  pricingType: 'language' | 'image' | 'video' | 'embedding' | 'browser-use' | 'transcription'
}

export type BudgetReservation = {
  reservationId: string
  reservedCents: number
  providerCostUsd: number
  pricingModelId: string
}

export interface ModelPricing {
  inputPer1M: number
  cachedInputPer1M: number
  outputPer1M: number
  isFree: boolean
}

export interface ImageGenerationPricing {
  perImage: number
}

export interface VideoGenerationPricing {
  billingUnit: 'per_video' | 'per_second'
  rate: number
}

export interface BrowserUseV3Pricing {
  inputPer1M: number
  outputPer1M: number
}

export const BROWSER_USE_TASK_INIT_USD = 0.01

export const BROWSER_USE_V3_MODEL_PRICING: Record<'bu-mini' | 'bu-max', BrowserUseV3Pricing> = {
  'bu-mini': { inputPer1M: 0.72, outputPer1M: 4.2 },
  'bu-max': { inputPer1M: 3.6, outputPer1M: 18.0 },
}

const gatewaySnapshot = VERCEL_AI_GATEWAY_PRICING_SNAPSHOT as unknown as GatewayPricingSnapshot
const gatewayModels = gatewaySnapshot.models

const MODEL_PRICING_ALIASES: Record<string, string> = {
  'claude-opus-4-6': 'anthropic/claude-opus-4.7',
  'claude-sonnet-4-6': 'anthropic/claude-sonnet-4.6',
  'claude-haiku-4-5': 'anthropic/claude-haiku-4.5',
  'gemini-3.1-pro-preview': 'google/gemini-3.1-pro-preview',
  'gemini-3-flash-preview': 'google/gemini-3-flash',
  'gpt-5.4': 'openai/gpt-5.4',
  'gpt-4.1-2025-04-14': 'openai/gpt-4.1',
  'grok-4-1-fast-reasoning': 'xai/grok-4.20-reasoning',
  'qwen/qwen3.6-plus': 'alibaba/qwen3.6-plus',
  'z-ai/glm-5.1': 'zai/glm-5.1',
  'gpt-5.2-pro-2025-12-11': 'openai/gpt-5.4',
  'gpt-5.2-2025-12-11': 'openai/gpt-5.4',
  'gpt-5-mini-2025-08-07': 'openai/gpt-5.4-mini',
  'gpt-5-nano-2025-08-07': 'openai/gpt-5.4-mini',
}

const MANUAL_LANGUAGE_PRICING: Record<string, ModelPricing> = {
  'llama-3.3-70b-versatile': { inputPer1M: 0.59, cachedInputPer1M: 0.59, outputPer1M: 0.79, isFree: false },
  'moonshotai/kimi-k2-0905': { inputPer1M: 0.3827, cachedInputPer1M: 0.1935, outputPer1M: 1.72, isFree: false },
  'moonshotai/kimi-k2-instruct-0905': { inputPer1M: 0.3827, cachedInputPer1M: 0.1935, outputPer1M: 1.72, isFree: false },
}

export const IMAGE_GENERATION_PRICING: Record<string, ImageGenerationPricing> = {
  // Gateway currently exposes these rows without a simple per-image unit price.
  'google/gemini-3.1-flash-image-preview': { perImage: 0.075 },
  'openai/gpt-image-1.5': { perImage: 0.04 },
  'bfl/flux-2-max': { perImage: 0.12 },
  'prodia/flux-fast-schnell': { perImage: 0.003 },
}

export const VIDEO_GENERATION_PRICING: Record<string, VideoGenerationPricing> = {
  // Kept only for non-Gateway/manual fallback compatibility. Gateway video
  // duration pricing is preferred when present.
  'bytedance/seedance-v1.5-pro': { billingUnit: 'per_second', rate: 0.0259 },
  'xai/grok-imagine-video': { billingUnit: 'per_second', rate: 0.07 },
}

export const MODEL_PRICING: Record<string, ModelPricing> = {
  ...MANUAL_LANGUAGE_PRICING,
  ...Object.fromEntries(
    Object.entries(MODEL_PRICING_ALIASES)
      .map(([modelId, pricingId]) => [modelId, languagePricingFromGatewayModel(pricingId)])
      .filter((entry): entry is [string, ModelPricing] => Boolean(entry[1])),
  ),
}

function parsePrice(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string' || value.trim() === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function parseTierArray(value: unknown): GatewayPricingTier[] | undefined {
  if (!Array.isArray(value)) return undefined
  const tiers = value
    .map((tier): GatewayPricingTier | null => {
      if (!tier || typeof tier !== 'object') return null
      const raw = tier as Record<string, unknown>
      const cost = parsePrice(raw.cost)
      if (cost === null) return null
      return {
        cost,
        min: typeof raw.min === 'number' ? raw.min : undefined,
        max: typeof raw.max === 'number' ? raw.max : undefined,
      }
    })
    .filter((tier): tier is GatewayPricingTier => Boolean(tier))
    .sort((a, b) => (a.min ?? 0) - (b.min ?? 0))
  return tiers.length > 0 ? tiers : undefined
}

function tieredTokenCost(tokens: number, basePerToken: number | null, rawTiers: unknown): number | null {
  const safeTokens = Math.max(0, Math.ceil(tokens))
  if (safeTokens === 0) return 0
  const tiers = parseTierArray(rawTiers)
  if (!tiers) return basePerToken === null ? null : safeTokens * basePerToken

  let total = 0
  for (const tier of tiers) {
    const min = Math.max(0, tier.min ?? 0)
    const max = tier.max ?? Number.POSITIVE_INFINITY
    if (safeTokens <= min) continue
    const chargedTokens = Math.max(0, Math.min(safeTokens, max) - min)
    total += chargedTokens * Number(tier.cost)
  }

  if (total === 0 && basePerToken !== null) return safeTokens * basePerToken
  return total
}

function resolveGatewayPricingId(modelId: string): string {
  return MODEL_PRICING_ALIASES[modelId] ?? modelId
}

export function getGatewayModelPricing(modelId: string): GatewayModelPricing | null {
  return gatewayModels[resolveGatewayPricingId(modelId)] ?? null
}

export function getPricingSnapshotMetadata(): Pick<GatewayPricingSnapshot, 'generatedAt' | 'source'> {
  return { generatedAt: gatewaySnapshot.generatedAt, source: gatewaySnapshot.source }
}

export function isExplicitFreeModel(modelId: string): boolean {
  return isFreeTierChatModelId(modelId)
}

function languagePricingFromGatewayModel(modelId: string): ModelPricing | null {
  const model = gatewayModels[resolveGatewayPricingId(modelId)]
  if (!model) return null
  const pricing = model.pricing
  const input = parsePrice(pricing.input)
  const output = parsePrice(pricing.output)
  if (input === null || output === null) return null
  return {
    inputPer1M: input * 1_000_000,
    cachedInputPer1M: (parsePrice(pricing.input_cache_read) ?? input) * 1_000_000,
    outputPer1M: output * 1_000_000,
    isFree: false,
  }
}

export function estimateTokenCost(modelId: string, inputTokens: number, cachedInputTokens: number, outputTokens: number): ProviderCostEstimate | null {
  if (isExplicitFreeModel(modelId)) {
    return {
      providerCostUsd: 0,
      pricingModelId: modelId,
      pricingSource: 'explicit-free',
      pricingType: 'language',
    }
  }

  const pricingModelId = resolveGatewayPricingId(modelId)
  const gatewayModel = gatewayModels[pricingModelId]
  if (gatewayModel) {
    const pricing = gatewayModel.pricing
    const uncachedInputTokens = Math.max(0, inputTokens - cachedInputTokens)
    const input = tieredTokenCost(uncachedInputTokens, parsePrice(pricing.input), pricing.input_tiers)
    const cachedInput = tieredTokenCost(cachedInputTokens, parsePrice(pricing.input_cache_read), pricing.input_cache_read_tiers)
    const output = tieredTokenCost(outputTokens, parsePrice(pricing.output), pricing.output_tiers)
    if (input === null || cachedInput === null || output === null) return null
    return {
      providerCostUsd: input + cachedInput + output,
      pricingModelId,
      pricingSource: 'gateway-snapshot',
      pricingType: 'language',
    }
  }

  const manual = MANUAL_LANGUAGE_PRICING[modelId]
  if (!manual || manual.isFree) return null
  const uncachedInput = Math.max(0, inputTokens - cachedInputTokens)
  return {
    providerCostUsd:
      (uncachedInput / 1_000_000) * manual.inputPer1M +
      (Math.max(0, cachedInputTokens) / 1_000_000) * manual.cachedInputPer1M +
      (Math.max(0, outputTokens) / 1_000_000) * manual.outputPer1M,
    pricingModelId: modelId,
    pricingSource: 'manual-override',
    pricingType: 'language',
  }
}

export function calculateTokenCost(
  modelId: string,
  inputTokens: number,
  cachedInputTokens: number,
  outputTokens: number,
): number {
  const estimate = estimateTokenCost(modelId, inputTokens, cachedInputTokens, outputTokens)
  if (!estimate) throw new PricingMissingError(modelId, 'language')
  return estimate.providerCostUsd
}

export function calculateTokenCostOrNull(
  modelId: string,
  inputTokens: number,
  cachedInputTokens: number,
  outputTokens: number,
): number | null {
  return estimateTokenCost(modelId, inputTokens, cachedInputTokens, outputTokens)?.providerCostUsd ?? null
}

export function estimateEmbeddingCost(modelId: string, inputTokens: number): ProviderCostEstimate | null {
  const pricingModelId = resolveGatewayPricingId(modelId)
  const gatewayModel = gatewayModels[pricingModelId]
  if (!gatewayModel) return null
  const input = tieredTokenCost(inputTokens, parsePrice(gatewayModel.pricing.input), gatewayModel.pricing.input_tiers)
  if (input === null) return null
  return {
    providerCostUsd: input,
    pricingModelId,
    pricingSource: 'gateway-snapshot',
    pricingType: 'embedding',
  }
}

export function calculateEmbeddingCostOrNull(modelId: string, inputTokens: number): number | null {
  return estimateEmbeddingCost(modelId, inputTokens)?.providerCostUsd ?? null
}

export function estimateImageCost(modelId: string): ProviderCostEstimate | null {
  const manual = IMAGE_GENERATION_PRICING[modelId]
  if (manual) {
    return {
      providerCostUsd: manual.perImage,
      pricingModelId: modelId,
      pricingSource: 'manual-override',
      pricingType: 'image',
    }
  }

  const pricingModelId = resolveGatewayPricingId(modelId)
  const gatewayModel = gatewayModels[pricingModelId]
  const image = parsePrice(gatewayModel?.pricing.image)
  if (image === null) return null
  return {
    providerCostUsd: image,
    pricingModelId,
    pricingSource: 'gateway-snapshot',
    pricingType: 'image',
  }
}

export function calculateImageCost(modelId: string): number {
  const estimate = estimateImageCost(modelId)
  if (!estimate) throw new PricingMissingError(modelId, 'image')
  return estimate.providerCostUsd
}

export function calculateImageCostOrNull(modelId: string): number | null {
  return estimateImageCost(modelId)?.providerCostUsd ?? null
}

function highestVideoDurationRate(pricing: Record<string, unknown>): number | null {
  const rows = pricing.video_duration_pricing
  if (!Array.isArray(rows)) return null
  let highest: number | null = null
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue
    const cost = parsePrice((row as GatewayVideoDurationPrice).cost_per_second)
    if (cost === null) continue
    highest = highest === null ? cost : Math.max(highest, cost)
  }
  return highest
}

export function estimateVideoCost(modelId: string, durationSeconds: number): ProviderCostEstimate | null {
  const pricingModelId = resolveGatewayPricingId(modelId)
  const gatewayModel = gatewayModels[pricingModelId]
  const safeDuration = Math.max(1, Math.ceil(durationSeconds))
  if (gatewayModel) {
    const durationRate = highestVideoDurationRate(gatewayModel.pricing)
    if (durationRate !== null) {
      return {
        providerCostUsd: durationRate * safeDuration,
        pricingModelId,
        pricingSource: 'gateway-snapshot',
        pricingType: 'video',
      }
    }
    const videoUnit = parsePrice(gatewayModel.pricing.video)
    if (videoUnit !== null) {
      return {
        providerCostUsd: videoUnit,
        pricingModelId,
        pricingSource: 'gateway-snapshot',
        pricingType: 'video',
      }
    }
  }

  const manual = VIDEO_GENERATION_PRICING[modelId]
  if (!manual) return null
  return {
    providerCostUsd: manual.billingUnit === 'per_video' ? manual.rate : manual.rate * safeDuration,
    pricingModelId: modelId,
    pricingSource: 'manual-override',
    pricingType: 'video',
  }
}

export function calculateVideoCost(modelId: string, durationSeconds: number): number {
  const estimate = estimateVideoCost(modelId, durationSeconds)
  if (!estimate) throw new PricingMissingError(modelId, 'video')
  return estimate.providerCostUsd
}

export function calculateVideoCostOrNull(modelId: string, durationSeconds: number): number | null {
  return estimateVideoCost(modelId, durationSeconds)?.providerCostUsd ?? null
}

export function calculateBrowserUseV3TokenCost(
  modelId: 'bu-mini' | 'bu-max',
  inputTokens: number,
  outputTokens: number,
): number {
  const pricing = BROWSER_USE_V3_MODEL_PRICING[modelId]
  return (Math.max(0, inputTokens) / 1_000_000) * pricing.inputPer1M + (Math.max(0, outputTokens) / 1_000_000) * pricing.outputPer1M
}

export function isPremiumModel(modelId: string): boolean {
  return !isExplicitFreeModel(modelId)
}

export function isPricedLanguageModel(modelId: string): boolean {
  return Boolean(estimateTokenCost(modelId, 1, 0, 1))
}

export function isPricedImageModel(modelId: string): boolean {
  return Boolean(estimateImageCost(modelId))
}

export function isPricedVideoModel(modelId: string, durationSeconds = 1): boolean {
  return Boolean(estimateVideoCost(modelId, durationSeconds))
}

export class PricingMissingError extends Error {
  readonly code = 'pricing_missing'
  readonly modelId: string
  readonly pricingType: ProviderCostEstimate['pricingType']

  constructor(modelId: string, pricingType: ProviderCostEstimate['pricingType']) {
    super(`Missing provider pricing for ${pricingType} model: ${modelId}`)
    this.name = 'PricingMissingError'
    this.modelId = modelId
    this.pricingType = pricingType
  }
}
