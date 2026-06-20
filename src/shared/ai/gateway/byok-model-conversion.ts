/**
 * Isomorphic helpers for converting BYOK (bring-your-own-key) provider
 * connections into {@link ChatModel} objects that merge into the model catalog.
 *
 * This module is shared between client and server (no Node builtins, no
 * server-only imports) so it can be used by Convex handlers, BFF routes, and
 * client hooks alike.
 */

import type { ChatModel } from '@/shared/ai/gateway/model-types'

/** Prefix for all BYOK-namespaced model IDs: `byok/{connectionId}/{rawModelId}`. */
export const BYOK_MODEL_PREFIX = 'byok/'

/** Returns `true` if the model ID is a BYOK-namespaced model. */
export function isByokModelId(modelId: string): boolean {
  return modelId.startsWith(BYOK_MODEL_PREFIX)
}

/**
 * Builds a BYOK-namespaced model ID from a connection ID and raw model ID.
 * Example: `byok/kx7abc123/llama-3.3-70b`
 */
export function byokModelId(connectionId: string, rawModelId: string): string {
  return `${BYOK_MODEL_PREFIX}${connectionId}/${rawModelId}`
}

/**
 * Parses a BYOK model ID into its connection ID and raw model ID components.
 * Returns `null` if the ID is not a valid BYOK model ID.
 */
export function parseByokModelId(
  modelId: string,
): { connectionId: string; rawModelId: string } | null {
  if (!modelId.startsWith(BYOK_MODEL_PREFIX)) return null
  const parts = modelId.slice(BYOK_MODEL_PREFIX.length).split('/')
  const connectionId = parts[0]
  const rawModelId = parts.slice(1).join('/')
  if (!connectionId || !rawModelId) return null
  return { connectionId, rawModelId }
}

// ─── Connection shape (matches the client-facing `list` query output) ───

export interface ByokConnectionRow {
  _id: string
  providerId: string
  endpoint: string
  displayName: string
  enabledModelIds: string[]
  discoveredModelsJson?: string
  discoveredAt?: number
  status: 'active' | 'error' | 'untested'
  lastError?: string
  lastTestedAt?: number
  isDefault: boolean
  isDeletable: boolean
  createdAt?: number
  updatedAt?: number
}

// ─── Discovery response shape (OpenAI-compatible /models) ───

interface DiscoveredModel {
  id: string
  name?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object'
}

export function isByokConnectionRow(value: unknown): value is ByokConnectionRow {
  if (!isRecord(value)) return false
  return (
    typeof value._id === 'string' &&
    typeof value.providerId === 'string' &&
    typeof value.endpoint === 'string' &&
    typeof value.displayName === 'string' &&
    Array.isArray(value.enabledModelIds) &&
    value.enabledModelIds.every((id) => typeof id === 'string') &&
    (value.status === 'active' || value.status === 'error' || value.status === 'untested') &&
    typeof value.isDefault === 'boolean' &&
    typeof value.isDeletable === 'boolean'
  )
}

/**
 * Parses the `discoveredModelsJson` field of a connection into a list of
 * `{ id, name }` models. Returns an empty array if the JSON is missing or
 * cannot be parsed.
 */
export function parseDiscoveredModels(json: string | undefined): DiscoveredModel[] {
  if (!json) return []
  try {
    const parsed = JSON.parse(json) as { data?: DiscoveredModel[] } | DiscoveredModel[]
    if (Array.isArray(parsed)) return parsed.filter((m) => typeof m.id === 'string')
    if (Array.isArray(parsed.data)) return parsed.data.filter((m) => typeof m.id === 'string')
    return []
  } catch {
    return []
  }
}

/**
 * Converts a single BYOK connection into an array of {@link ChatModel} objects,
 * one per enabled model. Only models in `enabledModelIds` are included — the
 * full discovered list may be larger, but the user selects which to enable.
 *
 * BYOK models use conservative defaults for capabilities (no vision, no
 * reasoning, no search, no ZDR) since we can't guarantee what the provider
 * supports. The user discovers capabilities empirically at runtime.
 */
export function byokConnectionToChatModels(connection: ByokConnectionRow): ChatModel[] {
  if (connection.isDefault && connection.providerId === 'vercel-ai-gateway') return []

  const discovered = parseDiscoveredModels(connection.discoveredModelsJson)
  const discoveredById = new Map(discovered.map((m) => [m.id, m]))

  return connection.enabledModelIds.map((rawModelId) => {
    const discovered = discoveredById.get(rawModelId)
    return {
      id: byokModelId(connection._id, rawModelId),
      name: discovered?.name ?? rawModelId,
      provider: connection.displayName,
      intelligence: 0,
      cost: 1,
      speedTier: 2,
      supportsVision: false,
      supportsReasoning: false,
      supportsSearch: false,
      supportsZeroDataRetention: false,
    }
  })
}

/**
 * Converts multiple BYOK connections into a flat array of {@link ChatModel}
 * objects, sorted by provider display name then model name.
 */
export function byokConnectionsToChatModels(
  connections: readonly ByokConnectionRow[] | unknown,
): ChatModel[] {
  if (!Array.isArray(connections)) return []
  const models: ChatModel[] = []
  for (const connection of connections) {
    if (!isByokConnectionRow(connection)) continue
    if (connection.status === 'error') continue
    models.push(...byokConnectionToChatModels(connection))
  }
  return models.sort(
    (a, b) => a.provider.localeCompare(b.provider) || a.name.localeCompare(b.name),
  )
}
