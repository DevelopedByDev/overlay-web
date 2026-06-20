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
import { getServerProviderKey } from '@/server/ai/gateway/server-provider-keys'
import { readByokVaultKey, readByokVaultKeyByName } from '@/server/ai/gateway/byok-vault'
import type { LanguageModelV3 } from '@/server/ai/provider-types'

const BYOK_MODEL_PREFIX = 'byok/'

interface ByokConnectionRow {
  _id: string
  userId: string
  providerId: string
  endpoint: string
  vaultKeyName: string
  vaultObjectId?: string
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
 * - If the connection has a vaultObjectId, read the key from WorkOS Vault by ID.
 * - If the connection has a vaultKeyName (but no object ID), read by name with
 *   env-var fallback (used by the default Vercel AI Gateway connection).
 * - If neither is set, fall back to the server-hosted key for the provider
 *   (e.g. Overlay's AI_GATEWAY_API_KEY for the default connection).
 */
async function resolveByokApiKey(connection: ByokConnectionRow): Promise<string | null> {
  if (connection.vaultObjectId) {
    return await readByokVaultKey(connection.vaultObjectId)
  }

  if (connection.vaultKeyName) {
    return await readByokVaultKeyByName(connection.vaultKeyName)
  }

  // Default Vercel AI Gateway connection with no user-supplied key — use
  // the server-hosted key.
  if (connection.providerId === 'vercel-ai-gateway') {
    return await getServerProviderKey('ai_gateway')
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

    const apiKey = await resolveByokApiKey(connection)
    const byokConnection: ByokConnection = {
      providerId: connection.providerId,
      endpoint: connection.endpoint,
    }
    const gateway = new ByokGateway({ connection: byokConnection, apiKey })
    const model = await gateway.createLanguageModel(rawModelId, { accessToken })
    return model.implementation as LanguageModelV3
  }

  // Existing path: Overlay-hosted gateway (Vercel AI Gateway default connection)
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
