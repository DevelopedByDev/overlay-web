import 'server-only'

import {
  getGatewayLanguageModel,
} from '@/server/ai/gateway/ai-gateway'
import {
  AVAILABLE_MODELS,
  getModel,
} from '@/shared/ai/gateway/model-data'
import { estimateTokenCost } from '@/shared/ai/gateway/model-pricing'
import type {
  LanguageModel,
  LLMGateway,
  ModelInfo,
  ModelOptions,
  PricingInfo,
} from '@overlay/app-core'

export class OpenRouterGateway implements LLMGateway {
  async createLanguageModel(
    modelId: string,
    options: ModelOptions = {},
  ): Promise<LanguageModel> {
    const model = getModel(modelId)
    const implementation = await getGatewayLanguageModel(modelId, options.accessToken)
    return {
      id: modelId,
      provider: model?.provider,
      implementation,
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    return AVAILABLE_MODELS.map((model) => ({
      id: model.id,
      name: model.name,
      provider: model.provider,
      description: model.description,
      supportsVision: model.supportsVision,
      supportsReasoning: model.supportsReasoning,
      supportsSearch: model.supportsSearch,
      supportsZeroDataRetention: model.supportsZeroDataRetention,
      pricePer1mTokens: model.pricePer1mTokens,
    }))
  }

  async getModelPricing(modelId: string): Promise<PricingInfo> {
    const model = getModel(modelId)
    const estimate = estimateTokenCost(modelId, 1_000_000, 0, 0)
    return {
      modelId,
      providerCostUsd: model?.pricePer1mTokens ?? estimate?.providerCostUsd,
      pricingModelId: estimate?.pricingModelId ?? modelId,
      pricingSource: estimate?.pricingSource ?? (model?.cost === 0 ? 'explicit-free' : undefined),
      pricingType: estimate?.pricingType ?? 'language',
      isFree: model?.cost === 0,
    }
  }
}
