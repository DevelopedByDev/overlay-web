import type { ChatModel } from '@/shared/ai/gateway/model-types'

export interface GatewayCatalogModel {
  id: string
  gatewayId: string
  name: string
  type: 'language' | 'image' | 'video' | 'embedding' | 'reranking'
  provider: string
  description?: string
  contextWindow?: number
  maxTokens?: number
  tags: string[]
  pricing: Record<string, unknown>
  inputPricePerMillion?: number
  outputPricePerMillion?: number
}

export function gatewayCatalogModelToChatModel(model: GatewayCatalogModel): ChatModel {
  const blendedPrice = ((model.inputPricePerMillion ?? 0) + (model.outputPricePerMillion ?? 0)) / 2
  const cost: ChatModel['cost'] =
    blendedPrice === 0 ? 0 : blendedPrice < 1 ? 1 : blendedPrice < 5 ? 2 : 3
  return {
    id: model.id,
    name: model.name,
    provider: model.provider,
    description: model.description,
    intelligence: 0,
    cost,
    speedTier: 2,
    supportsVision: model.tags.includes('vision'),
    supportsReasoning: model.tags.includes('reasoning'),
    supportsSearch: model.tags.includes('web-search'),
    supportsZeroDataRetention: false,
    pricePer1mTokens: blendedPrice,
  }
}
