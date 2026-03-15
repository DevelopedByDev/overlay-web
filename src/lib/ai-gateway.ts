import { createGateway } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { convex } from '@/lib/convex'
import { getModel } from '@/lib/models'

let cachedGateway: ReturnType<typeof createGateway> | null = null
let cachedApiKey: string | null = null

interface APIKeyResponse {
  key: string | null
}

async function resolveGatewayApiKey(accessToken?: string): Promise<string | null> {
  if (accessToken) {
    try {
      const result = await convex.action<APIKeyResponse>('keys:getAPIKey', {
        provider: 'ai_gateway',
        accessToken,
      })

      if (result?.key) {
        return result.key
      }
    } catch (error) {
      console.error('[AI Gateway] Failed to fetch key from Convex:', error)
    }
  }

  return process.env.AI_GATEWAY_API_KEY ?? null
}

async function resolveOpenRouterApiKey(accessToken?: string): Promise<string | null> {
  if (accessToken) {
    try {
      const result = await convex.action<APIKeyResponse>('keys:getAPIKey', {
        provider: 'openrouter',
        accessToken,
      })
      if (result?.key) return result.key
    } catch (error) {
      console.error('[OpenRouter] Failed to fetch key from Convex:', error)
    }
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

export async function getOpenRouterLanguageModel(modelId: string, accessToken?: string) {
  const apiKey = await resolveOpenRouterApiKey(accessToken)
  if (!apiKey) {
    throw new Error(
      'OPENROUTER_API_KEY is not configured. Set it in Convex or the server environment.'
    )
  }

  const openrouter = createOpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey,
  })

  return openrouter(modelId)
}

export async function getGatewayLanguageModel(modelId: string, accessToken?: string) {
  const model = getModel(modelId)

  // Route OpenRouter models to OpenRouter API
  if (model?.provider === 'openrouter') {
    return getOpenRouterLanguageModel(modelId, accessToken)
  }

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

  return cachedGateway(getGatewayModelId(modelId))
}
