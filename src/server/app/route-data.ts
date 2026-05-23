import 'server-only'

import { unstable_noStore as noStore } from 'next/cache'
import { headers } from 'next/headers'
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
import { getBaseUrl } from '@/server/web/app-url'

export type InitialIntegrationsRouteData = {
  bootstrap: AppBootstrapResponse | null
  connected: ConnectedIntegrationsResponse | null
  catalog: IntegrationSearchResponse | null
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

async function fetchAppJson<T>(path: string, fallback: T): Promise<T> {
  noStore()
  const headerList = await headers()
  const cookie = headerList.get('cookie')
  const response = await fetch(new URL(path, originFromHeaders(headerList)), {
    cache: 'no-store',
    headers: cookie ? { cookie } : undefined,
  })
  if (!response.ok) return fallback
  return response.json().catch(() => fallback) as Promise<T>
}

export function getInitialChatHistory(): Promise<CachedConversation[]> {
  return fetchAppJson<CachedConversation[]>('/api/app/conversations', [])
}

export function getInitialProjectList(): Promise<ProjectSummary[]> {
  return fetchAppJson<ProjectSummary[]>('/api/app/projects', [])
}

export function getInitialKnowledgeFiles(): Promise<KnowledgeFileNode[]> {
  return fetchAppJson<KnowledgeFileNode[]>('/api/app/files', [])
}

export function getInitialKnowledgeMemories(): Promise<MemoryRow[]> {
  return fetchAppJson<MemoryRow[]>('/api/app/memory', [])
}

export function getInitialAutomationsList(): Promise<AutomationSummary[]> {
  return fetchAppJson<AutomationSummary[]>('/api/app/automations', [])
}

export async function getInitialIntegrationsData(projectId?: string): Promise<InitialIntegrationsRouteData> {
  const connectedPath = projectId
    ? `/api/app/integrations?projectId=${encodeURIComponent(projectId)}`
    : null
  const catalogPath = `/api/app/integrations?action=search&limit=100${
    projectId ? `&projectId=${encodeURIComponent(projectId)}` : ''
  }`
  const [bootstrap, connected, catalog] = await Promise.all([
    fetchAppJson<AppBootstrapResponse | null>('/api/app/bootstrap', null),
    connectedPath
      ? fetchAppJson<ConnectedIntegrationsResponse | null>(connectedPath, null)
      : Promise.resolve(null),
    fetchAppJson<IntegrationSearchResponse | null>(catalogPath, null),
  ])

  return { bootstrap, connected, catalog }
}
