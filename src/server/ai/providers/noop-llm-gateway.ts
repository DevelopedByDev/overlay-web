import 'server-only'

import type {
  LanguageModel,
  LLMGateway,
  ModelInfo,
  ModelOptions,
  PricingInfo,
} from '@overlay/app-core'

export class NoOpLLMGateway implements LLMGateway {
  async createLanguageModel(
    modelId: string,
    options: ModelOptions = {},
  ): Promise<LanguageModel> {
    void options
    return {
      id: modelId,
      provider: 'noop',
      implementation: null,
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    return []
  }

  async getModelPricing(modelId: string): Promise<PricingInfo> {
    return {
      modelId,
      providerCostUsd: 0,
      pricingModelId: modelId,
      pricingSource: 'noop',
      pricingType: 'language',
      isFree: true,
    }
  }
}
