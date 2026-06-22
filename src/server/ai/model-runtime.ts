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
import { ByokGateway, type ByokConnection } from '@overlay/llm-gateway'
import { convex } from '@/server/database/convex'
import { getInternalApiSecret } from '@/server/shared/internal-api-secret'
import { readByokVaultKey } from '@/server/ai/gateway/byok-vault'
import { assertByokRuntimeConnectionAllowed } from '@/server/ai/gateway/byok-security'
import type { LanguageModelV3 } from '@/server/ai/provider-types'

const BYOK_MODEL_PREFIX = 'byok/'

interface ByokConnectionRow {
  _id: string
  userId: string
  providerId: string
  endpoint: string
  vaultObjectId?: string
  enabledModelIds: string[]
  isDefault: boolean
  status: string
}

/**
 * Fetches a BYOK provider connection from Convex by connection ID, verifying
 * that it belongs to the given user. Returns null if the connection doesn't
 * exist or doesn't belong to the user.
 */
async function getUserProviderConnection(
  userId: string | undefined,
  connectionId: string,
): Promise<ByokConnectionRow | null> {
  if (!userId) return null

  const serverSecret = getInternalApiSecret()
  const row = await convex.query<ByokConnectionRow | null>(
    'providers/connections:getByServer',
    { serverSecret, connectionId },
  )

  if (!row) return null
  if (row.userId !== userId) return null
  return row
}

/**
 * Resolves the API key for a BYOK connection.
 *
 * Only user-owned Vault object ids are honored here. Hosted gateway keys are
 * intentionally not available through BYOK model IDs.
 */
async function resolveByokApiKey(connection: ByokConnectionRow): Promise<string | null> {
  if (connection.vaultObjectId) {
    return await readByokVaultKey(connection.vaultObjectId)
  }

  return null
}

export async function getLanguageModel(
  modelId: string,
  accessToken?: string,
  userId?: string,
): Promise<LanguageModelV3> {
  // BYOK model IDs: byok/{connectionId}/{rawModelId}
  if (modelId.startsWith(BYOK_MODEL_PREFIX)) {
    const parts = modelId.slice(BYOK_MODEL_PREFIX.length).split('/')
    const connectionId = parts[0]
    const rawModelId = parts.slice(1).join('/')

    if (!connectionId || !rawModelId) {
      throw new Error(`Invalid BYOK model ID: ${modelId}`)
    }

    const connection = await getUserProviderConnection(userId, connectionId)
    if (!connection) {
      throw new Error(`BYOK connection not found: ${connectionId}`)
    }
    assertByokRuntimeConnectionAllowed(connection, rawModelId)

    const apiKey = await resolveByokApiKey(connection)
    const byokConnection: ByokConnection = {
      providerId: connection.providerId,
      endpoint: connection.endpoint,
    }
    const gateway = new ByokGateway({ connection: byokConnection, apiKey })
    const model = await gateway.createLanguageModel(rawModelId, { accessToken })
    return model.implementation as LanguageModelV3
  }

  // Existing path: Overlay-hosted gateway models.
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
