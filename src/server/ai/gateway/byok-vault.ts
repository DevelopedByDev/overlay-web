import 'server-only'

import { WorkOS } from '@workos-inc/node'
import { logger } from '@/server/observability/logger'

/**
 * Server-side helpers for writing, reading, and deleting BYOK (bring-your-own-key)
 * API keys in WorkOS Vault. These functions are used by the BFF routes that handle
 * provider connection create/update/delete — the Vault object ID is stored in the
 * Convex `userProviderConnections` table for future reference.
 *
 * Vault key naming convention: `byok_{userId}_{connectionId}`
 */

function getWorkOSClient(): WorkOS {
  const apiKey = process.env.WORKOS_API_KEY?.trim()
  if (!apiKey) {
    throw new Error(
      'WORKOS_API_KEY is not configured. BYOK vault operations require WorkOS Vault access.',
    )
  }
  return new WorkOS(apiKey)
}

/**
 * Creates a new Vault object storing the user's API key for a BYOK connection.
 * Returns the Vault object ID (stored in userProviderConnections.vaultObjectId).
 */
export async function writeByokVaultKey(
  vaultKeyName: string,
  apiKey: string,
): Promise<string> {
  const workos = getWorkOSClient()
  try {
    const result = await workos.vault.createObject({
      name: vaultKeyName,
      value: apiKey,
      context: {},
    })
    logger.info(`[BYOK Vault] Created vault object "${vaultKeyName}" (id: ${result.id})`)
    return result.id
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
  const workos = getWorkOSClient()
  try {
    await workos.vault.updateObject({
      id: vaultObjectId,
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
  const workos = getWorkOSClient()
  try {
    await workos.vault.deleteObject({ id: vaultObjectId })
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

  const workos = new WorkOS(apiKey)
  try {
    const obj = await workos.vault.readObject({ id: vaultObjectId })
    const val = typeof obj.value === 'string' ? obj.value.trim() : ''
    return val.length > 0 ? val : null
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.warn(`[BYOK Vault] Failed to read vault object (id: ${vaultObjectId}): ${message}`)
    return null
  }
}

/**
 * Reads a BYOK API key from the vault by its key name (falls back to env var).
 * Used when only the vaultKeyName is known (e.g. default Vercel AI Gateway
 * connection that may use a user-supplied key or the server-hosted key).
 */
export async function readByokVaultKeyByName(vaultKeyName: string): Promise<string | null> {
  const apiKey = process.env.WORKOS_API_KEY?.trim()
  if (!apiKey) {
    // Fall back to env var if WorkOS isn't configured (local dev)
    return process.env[vaultKeyName]?.trim() || null
  }

  const workos = new WorkOS(apiKey)
  try {
    const obj = await workos.vault.readObjectByName(vaultKeyName)
    const val = typeof obj.value === 'string' ? obj.value.trim() : ''
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
