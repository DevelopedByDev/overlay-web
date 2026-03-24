import path from 'node:path'
import { pathToFileURL } from 'node:url'
import type { ToolSet } from 'ai'
import { getServerProviderKey } from '@/lib/server-provider-keys'

type JsonRecord = Record<string, unknown>

const REMOVED_COMPOSIO_TOOLS = new Set([
  'COMPOSIO_REMOTE_BASH_TOOL',
  'COMPOSIO_REMOTE_WORKBENCH',
])

async function getComposioApiKey(accessToken?: string): Promise<string | null> {
  if (!accessToken) {
    return process.env.COMPOSIO_API_KEY ?? null
  }

  const serverKey = await getServerProviderKey('composio')
  return serverKey ?? process.env.COMPOSIO_API_KEY ?? null
}

function resolveComposioSessionIdFactory() {
  let composioSessionId: string | null = null

  function getProvidedSessionId(toolName: string, args: JsonRecord): string | undefined {
    if (toolName === 'COMPOSIO_SEARCH_TOOLS') {
      const session = args.session
      if (session && typeof session === 'object' && !Array.isArray(session)) {
        const id = (session as JsonRecord).id
        if (typeof id === 'string' && id.trim()) {
          return id.trim()
        }
      }
      return undefined
    }

    const sessionId = args.session_id
    return typeof sessionId === 'string' && sessionId.trim() ? sessionId.trim() : undefined
  }

  function resolve(toolName: string, args: JsonRecord): string {
    const provided = getProvidedSessionId(toolName, args)
    const fallbackSessionId = `overlay-web-${Date.now()}`

    if (!composioSessionId) {
      composioSessionId = provided || fallbackSessionId
    } else if (provided && provided !== composioSessionId) {
      console.warn(
        `[Composio] Overriding mismatched session_id for ${toolName}: ${provided} -> ${composioSessionId}`
      )
    }

    return composioSessionId
  }

  return { resolve }
}

function withConsistentComposioSession(
  toolName: string,
  args: JsonRecord,
  resolver: (toolName: string, args: JsonRecord) => string,
): JsonRecord {
  const sessionId = resolver(toolName, args)
  const normalized: JsonRecord = { ...args }

  if (toolName === 'COMPOSIO_SEARCH_TOOLS') {
    const existingSession =
      normalized.session &&
      typeof normalized.session === 'object' &&
      !Array.isArray(normalized.session)
        ? (normalized.session as JsonRecord)
        : {}

    normalized.session = {
      ...existingSession,
      id: sessionId,
    }

    if (normalized.session && typeof normalized.session === 'object') {
      delete (normalized.session as JsonRecord).generate_id
    }

    return normalized
  }

  normalized.session_id = sessionId
  return normalized
}

async function loadComposioModules(): Promise<{
  Composio: new (args: { apiKey: string; provider: unknown }) => {
    create: (entityId: string) => Promise<{ tools: () => Promise<ToolSet> }>
  }
  VercelProvider: new () => unknown
}> {
  const coreUrl = pathToFileURL(
    path.resolve(process.cwd(), '../overlay/node_modules/@composio/core/dist/index.mjs')
  ).href
  const vercelUrl = pathToFileURL(
    path.resolve(process.cwd(), '../overlay/node_modules/@composio/vercel/dist/index.mjs')
  ).href

  try {
    const coreModule = await import(/* webpackIgnore: true */ coreUrl)
    const vercelModule = await import(/* webpackIgnore: true */ vercelUrl)

    return {
      Composio: coreModule.Composio,
      VercelProvider: vercelModule.VercelProvider,
    }
  } catch (error) {
    throw new Error(
      `Composio packages are unavailable for overlay-landing: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

export async function createBrowserUnifiedTools(args: {
  userId: string
  accessToken?: string
}): Promise<ToolSet> {
  const apiKey = await getComposioApiKey(args.accessToken)
  if (!apiKey) {
    throw new Error('COMPOSIO_API_KEY is not configured. Set it in Convex or the server environment.')
  }

  const { Composio, VercelProvider } = await loadComposioModules()
  const composio = new Composio({ apiKey, provider: new VercelProvider() })
  const session = await composio.create(args.userId)
  const rawTools = (await session.tools()) as ToolSet
  const wrappedTools = {} as ToolSet
  const { resolve } = resolveComposioSessionIdFactory()

  for (const [toolName, toolDef] of Object.entries(rawTools)) {
    if (REMOVED_COMPOSIO_TOOLS.has(toolName)) {
      continue
    }

    if (!toolDef || typeof toolDef !== 'object') {
      continue
    }

    const originalExecute = (toolDef as { execute?: unknown }).execute
    if (typeof originalExecute !== 'function') {
      wrappedTools[toolName] = toolDef
      continue
    }

    wrappedTools[toolName] = {
      ...toolDef,
      execute: async (input: JsonRecord, extra: unknown) => {
        const normalizedInput = withConsistentComposioSession(toolName, input ?? {}, resolve)
        return (originalExecute as (input: JsonRecord, extra: unknown) => Promise<unknown>)(
          normalizedInput,
          extra
        )
      },
    }
  }

  return wrappedTools
}
