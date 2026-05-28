import 'server-only'

import { createGateway } from 'ai'
import { getModel } from '@/shared/ai/gateway/model-data'
import { getServerProviderKey } from '@/server/ai/gateway/server-provider-keys'

let cachedGateway: ReturnType<typeof createGateway> | null = null
let cachedApiKey: string | null = null

export async function resolveGatewayApiKey(accessToken?: string): Promise<string | null> {
  if (accessToken) {
    const serverKey = await getServerProviderKey('ai_gateway')
    if (serverKey) return serverKey
  }

  return process.env.AI_GATEWAY_API_KEY ?? null
}

export async function resolveOpenRouterApiKey(accessToken?: string): Promise<string | null> {
  if (accessToken) {
    const serverKey = await getServerProviderKey('openrouter')
    if (serverKey) return serverKey
  }
  return process.env.OPENROUTER_API_KEY ?? null
}

export function getGatewayModelId(modelId: string): string {
  const model = getModel(modelId)
  if (!model) {
    throw new Error(`Unknown model: ${modelId}`)
  }

  if (model.id.includes('/')) {
    return model.id
  }

  return `${model.provider}/${model.id}`
}

export async function getOrCreateGateway(accessToken?: string): Promise<ReturnType<typeof createGateway>> {
  const apiKey = await resolveGatewayApiKey(accessToken)
  if (!apiKey) {
    throw new Error(
      'AI_GATEWAY_API_KEY is not configured. Set it in Convex or the server environment.'
    )
  }
  if (!cachedGateway || cachedApiKey !== apiKey) {
    cachedGateway = createGateway({ apiKey })
    cachedApiKey = apiKey
  }
  return cachedGateway
}

const DEFAULT_GATEWAY_TOOL_PROXY_MODEL_ID = 'deepseek/deepseek-v4-flash'

export function resolveGatewayProviderToolProxyModelId(chatModelId?: string): string {
  if (!chatModelId) return DEFAULT_GATEWAY_TOOL_PROXY_MODEL_ID
  const model = getModel(chatModelId)
  if (!model) return DEFAULT_GATEWAY_TOOL_PROXY_MODEL_ID
  if (['openrouter', 'alibaba', 'zai', 'nvidia'].includes(model.provider)) {
    return DEFAULT_GATEWAY_TOOL_PROXY_MODEL_ID
  }
  return getGatewayModelId(chatModelId)
}
