import 'server-only'

import { getOverlayServerContext } from '@/server/bootstrap'
import {
  getGatewayImageModel,
  getGatewayModelId,
  getGatewayParallelSearchTool,
  getGatewayPerplexitySearchTool,
  getGatewayVideoModel,
  getOpenRouterLanguageModel,
  getOpenRouterLanguageModelCapturingRoutedModel,
  parallelSearchInputSchema,
  perplexitySearchInputSchema,
} from '@/server/ai/gateway/ai-gateway'
import { userFacingOpenRouterError } from '@/server/ai/gateway/openrouter-service'
import {
  createNvidiaNimChatLanguageModel,
  resolveNvidiaApiKey,
} from '@/server/ai/gateway/nvidia-nim-openai'
import type { LanguageModelV3 } from '@/server/ai/provider-types'

export async function getLanguageModel(
  modelId: string,
  accessToken?: string,
): Promise<LanguageModelV3> {
  const model = await getOverlayServerContext().llmGateway.createLanguageModel(
    modelId,
    { accessToken },
  )
  return model.implementation as LanguageModelV3
}

export {
  getGatewayImageModel,
  getGatewayModelId,
  getGatewayParallelSearchTool,
  getGatewayPerplexitySearchTool,
  getGatewayVideoModel,
  getOpenRouterLanguageModel,
  getOpenRouterLanguageModelCapturingRoutedModel,
  parallelSearchInputSchema,
  perplexitySearchInputSchema,
  userFacingOpenRouterError,
  createNvidiaNimChatLanguageModel,
  resolveNvidiaApiKey,
}
