import 'server-only'

import { logger } from '@/server/observability/logger'

/**
 * Server-side helpers for writing, reading, and deleting BYOK (bring-your-own-key)
 * API keys in WorkOS Vault. These functions are used by the BFF routes that handle
 * provider connection create/update/delete — the Vault object ID is stored in the
 * Convex `userProviderConnections` table for future reference.
 *
 * Vault key naming convention: `byok_{userId}_{connectionId}`
 */

export type ByokVaultKeyContext = {
  purpose: 'byok-provider-key'
  userId: string
  providerId: string
  connectionId?: string
}

type VaultObjectMetadata = {
  id?: unknown
}

type VaultObject = VaultObjectMetadata & {
  value?: unknown
}

function getWorkOSApiKey(): string {
  const apiKey = process.env.WORKOS_API_KEY?.trim()
  if (!apiKey) {
    throw new Error(
      'WORKOS_API_KEY is not configured. BYOK vault operations require WorkOS Vault access.',
    )
  }
  return apiKey
}

function getWorkOSBaseUrl(): string {
  return (process.env.WORKOS_API_BASE_URL?.trim() || 'https://api.workos.com').replace(/\/$/, '')
}

function formatVaultApiError(status: number, requestId: string | null, payload: unknown): string {
  const suffix = requestId ? ` (request id: ${requestId})` : ''
  if (!payload || typeof payload !== 'object') return `WorkOS Vault request failed (${status})${suffix}`

  const record = payload as Record<string, unknown>
  const message =
    typeof record.message === 'string' && record.message.trim()
      ? record.message.trim()
      : typeof record.error_description === 'string' && record.error_description.trim()
        ? record.error_description.trim()
        : typeof record.error === 'string' && record.error.trim()
          ? record.error.trim()
          : `WorkOS Vault request failed (${status})`
  const errors = record.errors
  if (Array.isArray(errors) && errors.length > 0) {
    const details = errors
      .map((entry) => {
        if (!entry || typeof entry !== 'object') return null
        const error = entry as Record<string, unknown>
        return typeof error.code === 'string'
          ? error.code
          : typeof error.message === 'string'
            ? error.message
            : null
      })
      .filter((entry): entry is string => Boolean(entry))
      .join(', ')
    return details ? `${message}: ${details}${suffix}` : `${message}${suffix}`
  }
  if (errors && typeof errors === 'object') {
    return `${message}: ${JSON.stringify(errors)}${suffix}`
  }
  return `${message}${suffix}`
}

async function vaultRequest<T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: Record<string, unknown>,
): Promise<T | null> {
  const response = await fetch(`${getWorkOSBaseUrl()}${path}`, {
    method,
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${getWorkOSApiKey()}`,
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: 'no-store',
  })

  if (response.status === 204) return null

  const text = await response.text()
  const payload = text
    ? (() => {
        try {
          return JSON.parse(text) as unknown
        } catch (_error) {
          return text
        }
      })()
    : null

  if (!response.ok) {
    throw new Error(formatVaultApiError(response.status, response.headers.get('x-request-id'), payload))
  }

  return payload as T
}

function getVaultObjectId(payload: VaultObjectMetadata | null): string {
  if (payload && typeof payload.id === 'string' && payload.id.trim()) return payload.id
  throw new Error('WorkOS Vault did not return an object id')
}

/**
 * Creates a new Vault object storing the user's API key for a BYOK connection.
 * Returns the Vault object ID (stored in userProviderConnections.vaultObjectId).
 */
export async function writeByokVaultKey(
  vaultKeyName: string,
  apiKey: string,
  context: ByokVaultKeyContext,
): Promise<string> {
  try {
    const result = await vaultRequest<VaultObjectMetadata>('POST', '/vault/v1/kv', {
      name: vaultKeyName,
      value: apiKey,
      key_context: context,
    })
    const vaultObjectId = getVaultObjectId(result)
    logger.info(`[BYOK Vault] Created vault object "${vaultKeyName}" (id: ${vaultObjectId})`)
    return vaultObjectId
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.error(`[BYOK Vault] Failed to create vault object "${vaultKeyName}": ${message}`)
    throw new Error(`Failed to store API key in vault: ${message}`)
  }
}

/**
 * Updates the value of an existing Vault object (key rotation).
 * Requires the vault object ID from the connection record.
 */
export async function updateByokVaultKey(
  vaultObjectId: string,
  apiKey: string,
): Promise<void> {
  try {
    await vaultRequest<VaultObject>('PUT', `/vault/v1/kv/${encodeURIComponent(vaultObjectId)}`, {
      value: apiKey,
    })
    logger.info(`[BYOK Vault] Updated vault object (id: ${vaultObjectId})`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.error(`[BYOK Vault] Failed to update vault object (id: ${vaultObjectId}): ${message}`)
    throw new Error(`Failed to rotate API key in vault: ${message}`)
  }
}

/**
 * Deletes a Vault object, removing the user's API key from the vault.
 * Called when a BYOK connection is deleted.
 */
export async function deleteByokVaultKey(vaultObjectId: string): Promise<void> {
  try {
    await vaultRequest<null>('DELETE', `/vault/v1/kv/${encodeURIComponent(vaultObjectId)}`)
    logger.info(`[BYOK Vault] Deleted vault object (id: ${vaultObjectId})`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.error(`[BYOK Vault] Failed to delete vault object (id: ${vaultObjectId}): ${message}`)
    // Don't throw — the Convex record is already being deleted; a stale vault
    // object is a minor leak, not a user-facing failure.
  }
}

/**
 * Reads a BYOK API key from the vault by its object ID.
 * Used by the runtime model resolver to fetch the user's key when routing
 * a request to a BYOK provider.
 *
 * Returns null if the vault object doesn't exist or can't be read (e.g.
 * WORKOS_API_KEY not configured, object was deleted out-of-band).
 */
export async function readByokVaultKey(vaultObjectId: string): Promise<string | null> {
  const apiKey = process.env.WORKOS_API_KEY?.trim()
  if (!apiKey) return null

  try {
    const obj = await vaultRequest<VaultObject>(
      'GET',
      `/vault/v1/kv/${encodeURIComponent(vaultObjectId)}`,
    )
    const val = typeof obj?.value === 'string' ? obj.value.trim() : ''
    return val.length > 0 ? val : null
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.warn(`[BYOK Vault] Failed to read vault object (id: ${vaultObjectId}): ${message}`)
    return null
  }
}

/**
 * Reads a BYOK API key from the vault by its key name (falls back to env var).
 * Used when only the vaultKeyName is known. Hosted Overlay gateway keys are
 * intentionally not resolved through BYOK runtime paths.
 */
export async function readByokVaultKeyByName(vaultKeyName: string): Promise<string | null> {
  const apiKey = process.env.WORKOS_API_KEY?.trim()
  if (!apiKey) {
    // Fall back to env var if WorkOS isn't configured (local dev)
    return process.env[vaultKeyName]?.trim() || null
  }

  try {
    const obj = await vaultRequest<VaultObject>(
      'GET',
      `/vault/v1/kv/name/${encodeURIComponent(vaultKeyName)}`,
    )
    const val = typeof obj?.value === 'string' ? obj.value.trim() : ''
    return val.length > 0 ? val : null
  } catch (_error) {
    // Object doesn't exist or can't be read — fall back to env var
    return process.env[vaultKeyName]?.trim() || null
  }
}

/**
 * Generates the vault key name for a BYOK connection.
 * Convention: `byok_{userId}_{connectionId}`
 */
export function byokVaultKeyName(userId: string, connectionId: string): string {
  return `byok_${userId}_${connectionId}`
}
