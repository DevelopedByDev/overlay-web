import { logger } from '@/server/observability/logger'
import type { ToolSet } from '@/server/ai/sdk'
import {
  getGatewayParallelSearchTool,
  getGatewayPerplexitySearchTool,
} from '@/server/ai/model-runtime'
import {
  filterGatewayCompatibleToolSet,
  summarizeGatewayToolSchemaViolations,
} from '@/server/ai/gateway/tool-schema-compat'
import { createBrowserUnifiedTools } from '@/server/tools/composio-tools'
import { createMcpLazyMetaTools } from '@/server/tools/mcp-tools'
import {
  allowedOverlayToolIdsForTurn,
} from '@/server/tools/tools/exposure-policy'
import {
  filterComposioToolSet,
  filterComposioToolSetForPaidOnlyFeatures,
} from '@/server/tools/tools/composio-filter'
import { createFreeTierGatedStubTools } from '@/server/tools/tools/free-tier-gated-stub-tools'
import { createWebTools } from '@/server/web/web-tools'
import {
  summarizeErrorForLog,
  summarizeToolIndexMapForLog,
  summarizeToolSetForLog,
} from '@/shared/security/safe-log'
import type { ChatToolRequestId } from '@/shared/chat/tool-requests'

type ActMode = 'chat' | 'automate'
type MediaToolIntent = 'image' | 'video' | null
type ToolDefinition = ToolSet[string]

export interface ActToolPreloadTasks {
  composioToolsTask: Promise<ToolSet>
}

export interface ActTooling {
  allowedOverlayToolIds: string[]
  composioStrippedForCompareSlot: boolean
  exposedMediaTools: string[]
  gatewaySearchLog: string
  missingGatewaySearchTools: boolean
  tools: ToolSet
  /** Populated when TTFT_DEBUG timing is collected during prepareActTooling. */
  ttft?: {
    mcpCatalogMs: number
  }
}

export function preloadActExternalToolTasks(params: {
  accessToken?: string
  serverSecret: string
  userId: string
}): ActToolPreloadTasks {
  const composioToolsTask = createBrowserUnifiedTools({
    userId: params.userId,
    accessToken: params.accessToken,
  })
  void composioToolsTask.catch((error) => {
    logger.warn('[conversations/act] Composio tool preload failed:', summarizeErrorForLog(error))
  })

  return { composioToolsTask }
}

export async function prepareActTooling(params: {
  accessToken?: string
  automationExecution?: boolean
  automationMode?: boolean
  automationId?: string
  baseUrl: string
  conversationId?: string
  conversationProjectId?: string
  effectiveModelId: string
  forwardCookie?: string | null
  isMultiModelFollowUpSlot: boolean
  latestUserText?: string
  memoryEnabled?: boolean
  mediaToolIntent: MediaToolIntent
  mode?: ActMode
  paid: boolean
  preloadTasks: ActToolPreloadTasks
  requestedToolIds?: readonly ChatToolRequestId[]
  serverSecret: string
  turnId: string
  userId: string
}): Promise<ActTooling> {
  const memoryEnabled = params.memoryEnabled !== false
  const allowedOverlayToolIds = withRequestedOverlayToolIds(
    allowedOverlayToolIdsForTurn({
      latestUserText: params.latestUserText ?? '',
      automationMode: params.automationMode === true || params.mode === 'automate',
      automationExecution: params.automationExecution === true,
      mediaToolIntent: params.mediaToolIntent,
    }),
    params.requestedToolIds ?? [],
    memoryEnabled,
  )

  const mcpCatalogStartedAt = performance.now()
  const mcpToolsTask = params.isMultiModelFollowUpSlot
    ? Promise.resolve({} as ToolSet)
    : createMcpLazyMetaTools({
        userId: params.userId,
        accessToken: params.accessToken,
        serverSecret: params.serverSecret,
        conversationId: params.conversationId,
        turnId: params.turnId,
        modelId: params.effectiveModelId,
      })
  const [composioRaw, mcpToolsRaw, webToolSet, perplexityTool, parallelTool] = await Promise.all([
    params.preloadTasks.composioToolsTask,
    mcpToolsTask,
    Promise.resolve(
      createWebTools({
        userId: params.userId,
        accessToken: params.accessToken,
        serverSecret: params.serverSecret,
        conversationId: params.conversationId,
        turnId: params.turnId,
        automationId: params.automationId,
        projectId: params.conversationProjectId,
        baseUrl: params.baseUrl,
        allowedToolIds: allowedOverlayToolIds,
        forwardCookie: params.forwardCookie ?? undefined,
        includePaidOnlyOverlayTools: params.paid,
        memoryEnabled,
      }),
    ),
    params.paid
      ? getGatewayPerplexitySearchTool(params.accessToken, params.effectiveModelId)
      : Promise.resolve(null),
    params.paid
      ? getGatewayParallelSearchTool(params.accessToken, params.effectiveModelId)
      : Promise.resolve(null),
  ])

  const mcpCatalogMs = params.isMultiModelFollowUpSlot
    ? 0
    : performance.now() - mcpCatalogStartedAt

  const tooling = buildActTooling({
    allowedOverlayToolIds,
    composioRaw,
    isMultiModelFollowUpSlot: params.isMultiModelFollowUpSlot,
    mcpToolsRaw,
    paid: params.paid,
    parallelTool,
    perplexityTool,
    webToolSet,
  })

  tooling.ttft = { mcpCatalogMs: +mcpCatalogMs.toFixed(1) }

  if (!params.paid) {
    return tooling
  }

  const compatible = await filterGatewayCompatibleToolSet(tooling.tools)
  if (compatible.dropped.length === 0) {
    return tooling
  }

  logger.warn(
    '[conversations/act] dropped Gateway-incompatible tools:',
    summarizeGatewayToolSchemaViolations(compatible.dropped),
  )
  return {
    ...tooling,
    tools: compatible.tools,
  }
}

export function buildActTooling(params: {
  allowedOverlayToolIds: string[]
  composioRaw: ToolSet
  isMultiModelFollowUpSlot: boolean
  mcpToolsRaw: ToolSet
  paid: boolean
  parallelTool: ToolDefinition | null
  perplexityTool: ToolDefinition | null
  webToolSet: ToolSet
}): ActTooling {
  const composioTools = filterComposioToolSetForPaidOnlyFeatures(
    filterComposioToolSet(params.composioRaw),
    params.paid,
  )
  const composioForAgent: ToolSet = params.isMultiModelFollowUpSlot ? {} : composioTools
  const freeTierStubsActive = !params.paid && !params.isMultiModelFollowUpSlot
  const freeTierGatedStubs: ToolSet = createFreeTierGatedStubTools(freeTierStubsActive)
  const mcpTools: ToolSet = params.isMultiModelFollowUpSlot ? {} : params.mcpToolsRaw
  const tools: ToolSet = {
    ...composioForAgent,
    ...mcpTools,
    ...params.webToolSet,
    ...freeTierGatedStubs,
    ...(params.perplexityTool ? { perplexity_search: params.perplexityTool } : {}),
    ...(params.parallelTool ? { parallel_search: params.parallelTool } : {}),
  }

  return {
    allowedOverlayToolIds: params.allowedOverlayToolIds,
    composioStrippedForCompareSlot: params.isMultiModelFollowUpSlot,
    exposedMediaTools: exposedMediaToolIds(params.webToolSet),
    gatewaySearchLog: [
      `perplexity:${params.perplexityTool ? 'yes' : 'no'}`,
      `parallel:${params.parallelTool ? 'yes' : 'no'}`,
    ].join(' '),
    missingGatewaySearchTools: !params.perplexityTool || !params.parallelTool,
    tools,
  }
}

export function logActTooling(tooling: Pick<ActTooling,
  'allowedOverlayToolIds' |
  'composioStrippedForCompareSlot' |
  'gatewaySearchLog' |
  'missingGatewaySearchTools' |
  'tools'
>): void {
  logger.info(
    '[conversations/act] tools:',
    summarizeToolSetForLog(tooling.tools),
    '| tool_index_map:',
    summarizeToolIndexMapForLog(tooling.tools),
    tooling.composioStrippedForCompareSlot ? '| composio:stripped_for_compare_slot' : '',
    '| allowed_overlay_tools:',
    tooling.allowedOverlayToolIds.join(', ') || '(none)',
    '| web_search (AI Gateway):',
    tooling.gatewaySearchLog,
    tooling.missingGatewaySearchTools ? ' — if missing, check AI_GATEWAY_API_KEY and Gateway logs' : '',
  )
}

function exposedMediaToolIds(webToolSet: ToolSet): string[] {
  return [
    'generate_image',
    'generate_video',
    'animate_image',
    'generate_video_with_reference',
    'apply_motion_control',
    'edit_video',
  ].filter((toolId) => toolId in webToolSet)
}

function withRequestedOverlayToolIds(
  baseToolIds: string[],
  requestedToolIds: readonly ChatToolRequestId[],
  memoryEnabled: boolean,
): string[] {
  const allowed = new Set(baseToolIds)
  if (!memoryEnabled) {
    allowed.delete('save_memory')
    allowed.delete('save_memory_batch')
    allowed.delete('update_memory')
    allowed.delete('delete_memory')
  }

  for (const toolId of requestedToolIds) {
    if (toolId === 'memory' && memoryEnabled) {
      allowed.add('search_knowledge')
      allowed.add('save_memory')
      allowed.add('save_memory_batch')
    }
    if (toolId === 'sandbox') {
      allowed.add('run_daytona_sandbox')
    }
    if (toolId === 'browser') {
      allowed.add('interactive_browser_session')
    }
  }

  return Array.from(allowed)
}
