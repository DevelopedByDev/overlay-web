import 'server-only'

import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { NextResponse } from 'next/server'
import { convex } from '@/server/database/convex'
import { projectComposioEntityId } from '@/server/tools/composio-entity'
import { getInternalApiSecret } from '@/server/tools/internal-api-secret'
import type { Id } from '../../../convex/_generated/dataModel'

export type ComposioAppRecord = {
  key?: string
  slug?: string
  name?: string
  displayName?: string
  display_name?: string
  appName?: string
  app_name?: string
  description?: string
  logo?: string
  logoUrl?: string
}

export type ConnectedAccountRecord = {
  id?: string
  /** v1 shape (deprecated/gone — endpoint returns 410). */
  appName?: string
  /** v3 shape — slug now lives under `toolkit.slug`. */
  toolkit?: { slug?: string } | null
}

export type ProjectComposioAccessResult =
  | { ok: true; entityId: string }
  | { ok: false; response: NextResponse }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadComposioSDK(apiKey: string, options?: Record<string, unknown>): Promise<any> {
  let ComposioModule: { Composio: new (args: { apiKey: string } & Record<string, unknown>) => unknown }

  try {
    ComposioModule = await import('@composio/core')
  } catch {
    const coreUrl = pathToFileURL(
      path.resolve(process.cwd(), '../overlay-desktop/node_modules/@composio/core/dist/index.mjs'),
    ).href
    ComposioModule = await import(/* webpackIgnore: true */ coreUrl)
  }

  const { Composio } = ComposioModule
  return new Composio({ apiKey, ...(options ?? {}) })
}

export async function getComposioApiKey(accessToken?: string): Promise<string | null> {
  const serverKey = accessToken
    ? await import('@/server/ai/provider-keys').then(({ getServerProviderKey }) =>
        getServerProviderKey('composio'),
      )
    : null
  return serverKey ?? process.env.COMPOSIO_API_KEY ?? null
}

export function firstNonEmptyString(...values: Array<unknown>): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }
  return null
}

export function normalizeComposioSlug(value: string): string {
  return value.trim().toLowerCase()
}

export async function requireProjectComposioEntity(
  projectId: string | null | undefined,
  userId: string,
): Promise<ProjectComposioAccessResult> {
  const trimmedProjectId = projectId?.trim()
  if (!trimmedProjectId) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'projectId required' }, { status: 400 }),
    }
  }

  try {
    const project = await convex.query<{ _id: string } | null>('projects/projects:get', {
      projectId: trimmedProjectId as Id<'projects'>,
      userId,
      serverSecret: getInternalApiSecret(),
    })
    if (!project) {
      return {
        ok: false,
        response: NextResponse.json({ error: 'Project not found' }, { status: 404 }),
      }
    }
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Project not found' }, { status: 404 }),
    }
  }

  return {
    ok: true,
    entityId: projectComposioEntityId(userId, trimmedProjectId),
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function listConnectedAccounts(composio: any, entityId: string): Promise<ConnectedAccountRecord[]> {
  try {
    const response = await composio.connectedAccounts.list({ userIds: [entityId] })
    return Array.isArray(response?.items) ? response.items : []
  } catch (err) {
    console.warn(
      `[composio-server] listConnectedAccounts SDK call failed for entity ${entityId.slice(-8)}:`,
      err instanceof Error ? err.message : String(err),
    )
    return []
  }
}

/** Reads the toolkit slug from either v1 or v3 shape (v3 stores it at `toolkit.slug`). */
export function connectedAccountSlug(acc: ConnectedAccountRecord): string | undefined {
  if (typeof acc.toolkit?.slug === 'string' && acc.toolkit.slug.trim()) return acc.toolkit.slug
  if (typeof acc.appName === 'string' && acc.appName.trim()) return acc.appName
  return undefined
}

export async function hasConnectedToolkit(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  composio: any,
  entityId: string,
  toolkitSlug: string,
): Promise<boolean> {
  const normalized = normalizeComposioSlug(toolkitSlug)
  const accounts = await listConnectedAccounts(composio, entityId)
  return accounts.some((account) => normalizeComposioSlug(connectedAccountSlug(account) ?? '') === normalized)
}
