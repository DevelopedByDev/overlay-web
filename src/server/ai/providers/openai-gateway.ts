import 'server-only'

import { createOpenAI } from '@ai-sdk/openai'
import type {
  LanguageModel,
  LLMGateway,
  ModelInfo,
  ModelOptions,
  PricingInfo,
} from '@overlay/llm-gateway'

export interface OpenAILLMGatewayConfig {
  apiKey?: string
  apiKeyEnvVar?: string
  defaultChatModelId?: string
  modelAllowlist?: readonly string[]
}

export class OpenAILLMGateway implements LLMGateway {
  readonly providerConfigSummary: {
    provider: 'openai'
    apiKeyEnvVar?: string
    hasInlineApiKey: boolean
    defaultChatModelId?: string
    modelAllowlist: readonly string[]
  }

  constructor(private readonly config: OpenAILLMGatewayConfig = {}) {
    this.providerConfigSummary = {
      provider: 'openai',
      ...(config.apiKeyEnvVar ? { apiKeyEnvVar: config.apiKeyEnvVar } : {}),
      hasInlineApiKey: Boolean(config.apiKey),
      ...(config.defaultChatModelId ? { defaultChatModelId: config.defaultChatModelId } : {}),
      modelAllowlist: config.modelAllowlist ?? [],
    }
  }

  async createLanguageModel(
    modelId: string,
    options: ModelOptions = {},
  ): Promise<LanguageModel> {
    void options
    const apiKey = this.resolveApiKey()
    const implementation = apiKey ? createOpenAI({ apiKey })(modelId) : null
    return {
      id: modelId,
      provider: 'openai',
      implementation,
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    const ids = this.config.modelAllowlist?.length
      ? this.config.modelAllowlist
      : this.config.defaultChatModelId
        ? [this.config.defaultChatModelId]
        : []

    return ids.map((id) => ({
      id,
      name: id,
      provider: 'openai',
    }))
  }

  async getModelPricing(modelId: string): Promise<PricingInfo> {
    return {
      modelId,
      pricingModelId: modelId,
      pricingSource: 'runtime-config',
      pricingType: 'language',
      isFree: false,
    }
  }

  private resolveApiKey(): string | null {
    if (this.config.apiKey) return this.config.apiKey
    const envVar = this.config.apiKeyEnvVar ?? 'OPENAI_API_KEY'
    return process.env[envVar]?.trim() || null
  }
}
