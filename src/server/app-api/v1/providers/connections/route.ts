import { NextRequest, NextResponse } from 'next/server'
import type { AppApiRouteContext } from '@/server/app-api/bff-context'
import { getInternalApiSecret } from '@/server/shared/internal-api-secret'
import { convex } from '@/server/database/convex'
import { validatePublicNetworkUrl } from '@/server/security/ssrf'
import type { ByokConnectionRow } from '@/shared/ai/gateway/byok-model-conversion'
import {
  writeByokVaultKey,
  updateByokVaultKey,
  deleteByokVaultKey,
  byokVaultKeyName,
  type ByokVaultKeyContext,
} from '@/server/ai/gateway/byok-vault'
import { getGatewayLanguageCatalog } from '@/server/ai/gateway/gateway-catalog'
import { getByokPreset } from '@overlay/llm-gateway'

const DEFAULT_GATEWAY_PROVIDER_ID = 'vercel-ai-gateway'

async function validateEndpointUrl(url: unknown): Promise<string | null> {
  const result = await validatePublicNetworkUrl(url, { allowLocalDev: false, requireHttps: true })
  return result.ok ? null : result.error
}

function sortConnections(connections: ByokConnectionRow[]): ByokConnectionRow[] {
  return [...connections].sort((a, b) => {
    if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1
    return a.displayName.localeCompare(b.displayName)
  })
}

function defaultGatewayNeedsSeed(connections: readonly ByokConnectionRow[]): boolean {
  const existing = connections.find(
    (connection) => connection.providerId === DEFAULT_GATEWAY_PROVIDER_ID && connection.isDefault,
  )
  if (!existing) return true
  return existing.enabledModelIds.length === 0 || !existing.discoveredModelsJson
}

async function ensureDefaultGatewayConnection(
  userId: string,
  serverSecret: string,
  connections: readonly ByokConnectionRow[],
): Promise<ByokConnectionRow[]> {
  if (!defaultGatewayNeedsSeed(connections)) return [...connections]

  const preset = getByokPreset(DEFAULT_GATEWAY_PROVIDER_ID)
  if (!preset) return [...connections]

  const gatewayModels = await getGatewayLanguageCatalog().catch((_error) => [])
  const discoveredModels = gatewayModels.map((model) => ({
    id: model.id,
    name: model.name,
  }))
  const seeded = await convex.mutation<ByokConnectionRow>(
    'providers/connections:ensureDefaultGatewayByServer',
    {
      serverSecret,
      userId,
      endpoint: preset.defaultBaseURL,
      displayName: preset.label,
      enabledModelIds: discoveredModels.map((model) => model.id),
      ...(discoveredModels.length > 0
        ? {
            discoveredModelsJson: JSON.stringify({ data: discoveredModels }),
            discoveredAt: Date.now(),
          }
        : {}),
    },
  )
  if (!seeded) return [...connections]

  return [
    seeded,
    ...connections.filter((connection) => connection._id !== seeded._id),
  ]
}

function buildVaultContext(
  userId: string,
  providerId: string,
  connectionId?: string,
): ByokVaultKeyContext {
  return {
    purpose: 'byok-provider-key',
    userId,
    providerId,
    ...(connectionId ? { connectionId } : {}),
  }
}

// GET /api/v1/providers/connections — list the authenticated user's connections
export async function GET(request: NextRequest, context: AppApiRouteContext) {
  try {
    const { auth } = context
    const serverSecret = getInternalApiSecret()

    const connections = await convex.query<ByokConnectionRow[]>(
      'providers/connections:listPublicByServer',
      {
        serverSecret,
        userId: auth.userId,
      },
    )
    const seededConnections = await ensureDefaultGatewayConnection(
      auth.userId,
      serverSecret,
      connections || [],
    )
    const data = sortConnections(seededConnections)
    return NextResponse.json({ data, hasMore: false, total: data.length })
  } catch (_error) {
    return NextResponse.json({ error: 'Failed to fetch provider connections' }, { status: 500 })
  }
}

// POST /api/v1/providers/connections — create a new BYOK provider connection
export async function POST(request: NextRequest, context: AppApiRouteContext) {
  try {
    const body = await request.json()
    const { auth } = context
    const serverSecret = getInternalApiSecret()

    const {
      providerId,
      endpoint,
      displayName,
      apiKey,
      enabledModelIds,
    } = body as Record<string, unknown>

    if (!providerId || typeof providerId !== 'string') {
      return NextResponse.json({ error: 'providerId is required' }, { status: 400 })
    }

    const preset = getByokPreset(providerId)
    if (!preset) {
      return NextResponse.json({ error: `Unknown provider: ${providerId}` }, { status: 400 })
    }

    // Resolve endpoint: use the provided value, or fall back to the preset default
    const resolvedEndpoint =
      typeof endpoint === 'string' && endpoint.trim()
        ? endpoint.trim()
        : preset.defaultBaseURL

    if (!resolvedEndpoint) {
      return NextResponse.json(
        { error: 'endpoint is required for custom providers' },
        { status: 400 },
      )
    }

    // Validate the endpoint URL (SSRF protection)
    const urlError = await validateEndpointUrl(resolvedEndpoint)
    if (urlError) {
      return NextResponse.json({ error: urlError }, { status: 400 })
    }

    if (!displayName || typeof displayName !== 'string') {
      return NextResponse.json({ error: 'displayName is required' }, { status: 400 })
    }

    if (preset.requiresApiKey && (!apiKey || typeof apiKey !== 'string')) {
      return NextResponse.json(
        { error: `API key is required for ${preset.label}` },
        { status: 400 },
      )
    }

    // 1. Write the API key to WorkOS Vault with an up-front unique key name.
    const vaultKeyName = byokVaultKeyName(auth.userId, `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`)

    let vaultObjectId: string | undefined
    if (typeof apiKey === 'string' && apiKey.length > 0) {
      vaultObjectId = await writeByokVaultKey(
        vaultKeyName,
        apiKey,
        buildVaultContext(auth.userId, providerId),
      )
    }

    // 2. Create the Convex record
    const connectionId = await convex.mutation<string>('providers/connections:createByServer', {
      serverSecret,
      userId: auth.userId,
      providerId,
      endpoint: resolvedEndpoint,
      displayName,
      vaultKeyName,
      vaultObjectId,
      enabledModelIds: Array.isArray(enabledModelIds)
        ? (enabledModelIds as string[])
        : [],
      isDefault: preset.isDefault,
      isDeletable: preset.isDeletable,
    })

    if (!connectionId) {
      return NextResponse.json(
        { error: 'Failed to create provider connection' },
        { status: 500 },
      )
    }

    return NextResponse.json({ id: connectionId })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create provider connection'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// PATCH /api/v1/providers/connections — update an existing connection
export async function PATCH(request: NextRequest, context: AppApiRouteContext) {
  try {
    const body = await request.json()
    const { auth } = context
    const serverSecret = getInternalApiSecret()

    const {
      connectionId,
      displayName,
      endpoint,
      apiKey,
      enabledModelIds,
      status,
      lastError,
      lastTestedAt,
      discoveredModelsJson,
      discoveredAt,
    } = body as Record<string, unknown>

    if (!connectionId || typeof connectionId !== 'string') {
      return NextResponse.json({ error: 'connectionId is required' }, { status: 400 })
    }

    // Fetch the existing connection to verify ownership and get vault info
    const existing = await convex.query<{
      userId: string
      vaultObjectId?: string
      providerId: string
      displayName?: string
    } | null>(
      'providers/connections:getByServer',
      { serverSecret, connectionId },
    )

    if (!existing) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
    }

    // Verify the connection belongs to the authenticated user
    if (existing.userId !== auth.userId) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
    }

    // If a new API key is provided, update it in the vault
    let vaultObjectId: string | undefined
    if (typeof apiKey === 'string' && apiKey.length > 0) {
      if (existing.vaultObjectId) {
        // Key rotation — update the existing vault object
        await updateByokVaultKey(existing.vaultObjectId, apiKey)
        vaultObjectId = existing.vaultObjectId
      } else {
        // No existing vault object — create a new one
        const vaultKeyName = byokVaultKeyName(auth.userId, connectionId)
        vaultObjectId = await writeByokVaultKey(
          vaultKeyName,
          apiKey,
          buildVaultContext(
            auth.userId,
            existing.providerId,
            connectionId,
          ),
        )
      }
    }

    // Validate endpoint if it's being updated
    if (typeof endpoint === 'string' && endpoint.trim()) {
      const urlError = await validateEndpointUrl(endpoint)
      if (urlError) {
        return NextResponse.json({ error: urlError }, { status: 400 })
      }
    }

    await convex.mutation('providers/connections:updateByServer', {
      serverSecret,
      connectionId,
      ...(displayName !== undefined ? { displayName } : {}),
      ...(endpoint !== undefined ? { endpoint } : {}),
      ...(vaultObjectId !== undefined ? { vaultObjectId } : {}),
      ...(Array.isArray(enabledModelIds) ? { enabledModelIds } : {}),
      ...(discoveredModelsJson !== undefined ? { discoveredModelsJson } : {}),
      ...(discoveredAt !== undefined ? { discoveredAt } : {}),
      ...(status !== undefined ? { status } : {}),
      ...(lastError !== undefined ? { lastError } : {}),
      ...(lastTestedAt !== undefined ? { lastTestedAt } : {}),
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update provider connection'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// DELETE /api/v1/providers/connections?connectionId=... — delete a connection
export async function DELETE(request: NextRequest, context: AppApiRouteContext) {
  try {
    const { auth } = context
    const serverSecret = getInternalApiSecret()

    const connectionId = request.nextUrl.searchParams.get('connectionId')
    if (!connectionId) {
      return NextResponse.json({ error: 'connectionId is required' }, { status: 400 })
    }

    // Fetch the connection to get the vault object ID for cleanup
    const existing = await convex.query<{
      userId: string
      vaultObjectId?: string
      isDeletable: boolean
    } | null>(
      'providers/connections:getByServer',
      { serverSecret, connectionId },
    )

    if (!existing) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
    }

    // Verify the connection belongs to the authenticated user
    if (existing.userId !== auth.userId) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
    }

    if (!existing.isDeletable) {
      return NextResponse.json(
        { error: 'This connection cannot be deleted (it is the default provider)' },
        { status: 403 },
      )
    }

    // 1. Delete the vault object (best-effort — don't block on vault failures)
    if (existing.vaultObjectId) {
      await deleteByokVaultKey(existing.vaultObjectId)
    }

    // 2. Delete the Convex record
    await convex.mutation('providers/connections:deleteByServer', {
      serverSecret,
      connectionId,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete provider connection'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
