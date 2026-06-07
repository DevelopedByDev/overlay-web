import 'server-only'

import { unstable_noStore as noStore } from 'next/cache'
import { headers } from 'next/headers'
import { NextRequest } from 'next/server'
import type {
  AppBootstrapResponse,
  AutomationSummary,
  ConnectedIntegrationsResponse,
  IntegrationSearchResponse,
  KnowledgeFileNode,
  MemoryRow,
  ProjectSummary,
} from '@overlay/app-core'
import type { CachedConversation } from '@/shared/chat/chat-list-cache'
import { unwrapPaginatedData } from '@/shared/api/pagination'
import { getBaseUrl } from '@/server/web/app-url'
import { handleBffRoute, type BffDomainService } from '@/app/api/v1/_utils/bff'
import * as conversationsService from '@/server/app-api/v1/conversations/route'
import * as projectsService from '@/server/app-api/v1/projects/route'
import * as filesService from '@/server/app-api/v1/files/route'
import * as memoryService from '@/server/app-api/v1/memory/route'
import * as automationsService from '@/server/app-api/v1/automations/route'
import * as bootstrapService from '@/server/app-api/v1/bootstrap/route'
import * as integrationsService from '@/server/app-api/v1/integrations/route'
import { convex } from '@/server/database/convex'
import { getInternalApiSecret } from '@/server/shared/internal-api-secret'
import { automationService } from '@/server/automations/http'

export type InitialIntegrationsRouteData = {
  bootstrap: AppBootstrapResponse | null
  connected: ConnectedIntegrationsResponse | null
  catalog: IntegrationSearchResponse | null
}

export type InitialAppShellData = {
  initialProjects: ProjectSummary[]
  initialAutomations?: AutomationSummary[]
}

function originFromHeaders(headerList: Headers): string {
  const host = headerList.get('x-forwarded-host') ?? headerList.get('host')
  if (!host) return getBaseUrl()

  const forwardedProto = headerList.get('x-forwarded-proto')?.split(',')[0]?.trim()
  const proto =
    forwardedProto ||
    (host.startsWith('localhost') || host.startsWith('127.0.0.1') || host.startsWith('[::1]')
      ? 'http'
      : 'https')

  return `${proto}://${host}`
}

/**
 * Server-side initial data loads call the v1 BFF domain services in-process via
 * the shared {@link handleBffRoute} pipeline instead of issuing an HTTP request
 * back to our own `/api/v1/*` routes. This removes the Next server -> Next API
 * route -> Convex loopback hop while preserving identical behavior (auth,
 * capability checks, rate limits, idempotency, and pagination envelopes).
 */
async function callAppApi<T>(path: string, service: BffDomainService, fallback: T): Promise<T> {
  noStore()
  const headerList = await headers()
  const cookie = headerList.get('cookie')
  const url = new URL(path, originFromHeaders(headerList))
  const request = new NextRequest(url, {
    headers: cookie ? { cookie } : undefined,
  })
  const response = await handleBffRoute(request, {}, service)
  if (!response.ok) return fallback
  const value = await response.json().catch((_error) => fallback)
  if (Array.isArray(fallback)) {
    return unwrapPaginatedData(value as unknown, fallback as unknown[]) as T
  }
  return value as T
}

export function getInitialChatHistory(): Promise<CachedConversation[]> {
  return callAppApi<CachedConversation[]>(
    '/api/v1/conversations?limit=100',
    conversationsService.GET as BffDomainService,
    [],
  )
}

export function getInitialProjectList(): Promise<ProjectSummary[]> {
  return callAppApi<ProjectSummary[]>(
    '/api/v1/projects?limit=100',
    projectsService.GET as BffDomainService,
    [],
  )
}

export function getInitialKnowledgeFiles(): Promise<KnowledgeFileNode[]> {
  return callAppApi<KnowledgeFileNode[]>(
    '/api/v1/files?limit=100&summary=true',
    filesService.GET as BffDomainService,
    [],
  )
}

export function getInitialKnowledgeMemories(): Promise<MemoryRow[]> {
  return callAppApi<MemoryRow[]>(
    '/api/v1/memory?limit=100',
    memoryService.GET as BffDomainService,
    [],
  )
}

export function getInitialAutomationsList(): Promise<AutomationSummary[]> {
  return callAppApi<AutomationSummary[]>(
    '/api/v1/automations?limit=100',
    automationsService.GET as BffDomainService,
    [],
  )
}

export async function getInitialAppShellData({
  userId,
  includeAutomations,
}: {
  userId: string
  includeAutomations: boolean
}): Promise<InitialAppShellData> {
  noStore()
  const serverSecret = getInternalApiSecret()
  const [projectsResult, initialAutomations] = await Promise.all([
    convex.query<ProjectSummary[]>('projects/projects:list', {
      userId,
      serverSecret,
    }).catch((_error) => []),
    includeAutomations
      ? automationService.getAutomations({ userId }).then((result) => (
          Array.isArray(result) ? result as AutomationSummary[] : []
        )).catch((_error) => [])
      : Promise.resolve(undefined),
  ])

  return { initialProjects: projectsResult ?? [], initialAutomations }
}

export async function getInitialIntegrationsData(): Promise<InitialIntegrationsRouteData> {
  const [bootstrap, connected, catalog] = await Promise.all([
    callAppApi<AppBootstrapResponse | null>(
      '/api/v1/bootstrap',
      bootstrapService.GET as BffDomainService,
      null,
    ),
    callAppApi<ConnectedIntegrationsResponse | null>(
      '/api/v1/integrations',
      integrationsService.GET as BffDomainService,
      null,
    ),
    callAppApi<IntegrationSearchResponse | null>(
      '/api/v1/integrations?action=search&limit=100',
      integrationsService.GET as BffDomainService,
      null,
    ),
  ])

  return { bootstrap, connected, catalog }
}
