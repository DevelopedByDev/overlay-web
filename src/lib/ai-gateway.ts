import { createGateway } from 'ai'
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

export async function getGatewayLanguageModel(modelId: string, accessToken?: string) {
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
