import { convertToModelMessages, stepCountIs, ToolLoopAgent, type LanguageModelUsage } from 'ai'
import { convex } from '@/lib/convex'
import {
  getGatewayLanguageModel,
  getGatewayParallelSearchTool,
  getGatewayPerplexitySearchTool,
} from '@/lib/ai-gateway'
import { createBrowserUnifiedTools } from '@/lib/composio-tools'
import { createWebTools } from '@/lib/web-tools'
import { filterComposioToolSet } from '@/lib/tools/composio-filter'
import { fireAndForgetRecordToolInvocation } from '@/lib/tools/record-tool-invocation'
import { MAX_TOOL_STEPS_ACT } from '@/lib/tools/policy'
import { calculateTokenCost } from '@/lib/model-pricing'
import { billableBudgetCentsFromProviderUsd } from '@/lib/billing-runtime'
import { buildAssistantPersistenceFromSteps } from '@/lib/persist-assistant-turn'
import type { AutomationSummary } from '@/lib/automations'
import { summarizeAssistantMessage } from '@/lib/automation-runner'
import type { Id } from '../../convex/_generated/dataModel'

type AutomationExecutorMetadata = {
  platform: 'vercel' | 'local' | 'unknown'
  region?: string
  deploymentId?: string
  runtime?: string
}

type ExecuteAutomationConversationTurnArgs = {
  automation: AutomationSummary
  baseUrl: string
  conversationId: Id<'conversations'>
  prompt: string
  turnId: string
  userId: string
  serverSecret: string
  requestId: string
  executor: AutomationExecutorMetadata
  onEvent?: (event: {
    stage: 'dispatching' | 'running' | 'persisting' | 'succeeded' | 'failed' | 'needs_setup'
    level: 'info' | 'warning' | 'error'
    message: string
    metadata?: Record<string, unknown>
  }) => Promise<void>
  onHeartbeat?: (stage?: 'running' | 'persisting') => Promise<void>
}

function buildAutomationUserMessage(prompt: string, turnId: string) {
  return {
    id: turnId,
    role: 'user' as const,
    parts: [{ type: 'text' as const, text: prompt }],
  }
}

function clampErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return 'Automation execution failed'
}

function automationExecutionError(message: string, failureStage: string, turnId: string) {
  const error = new Error(message) as Error & { failureStage?: string; turnId?: string }
  error.failureStage = failureStage
  error.turnId = turnId
  return error
}

function buildActInstructions(): string {
  return [
    'You are Overlay’s automation agent.',
    'Execute the requested workflow exactly once for this run.',
    'Use tools when needed, keep side effects intentional, and finish with a concise summary of what completed and what still needs attention.',
    'If the workflow cannot be completed, explain the blocker clearly instead of pretending success.',
  ].join('\n\n')
}

async function recordAutomationUsage(args: {
  userId: string
  serverSecret: string
  modelId: string
  usage?: LanguageModelUsage
}) {
  const inputTokens = args.usage?.inputTokens ?? 0
  const outputTokens = args.usage?.outputTokens ?? 0
  const costDollars = calculateTokenCost(args.modelId, inputTokens, 0, outputTokens)
  const costCents = billableBudgetCentsFromProviderUsd(costDollars)
  if (costCents <= 0 && inputTokens <= 0 && outputTokens <= 0) return

  await convex.mutation(
    'usage:recordBatch',
    {
      serverSecret: args.serverSecret,
      userId: args.userId,
      events: [{
        type: args.modelId ? 'agent' : 'ask',
        modelId: args.modelId,
        inputTokens,
        outputTokens,
        cachedTokens: 0,
        cost: costCents,
        timestamp: Date.now(),
      }],
    },
    { throwOnError: true },
  )
}

export function resolveAutomationExecutorMetadata(headers: Headers): AutomationExecutorMetadata {
  const region = headers.get('x-vercel-id')?.split(':').at(0)?.trim() || headers.get('x-vercel-edge-region')?.trim() || undefined
  const deploymentId = headers.get('x-vercel-deployment-url')?.trim() || process.env.VERCEL_URL?.trim() || undefined
  const runtime = process.env.VERCEL ? 'vercel' : process.env.NODE_ENV === 'development' ? 'local' : 'unknown'
  return {
    platform: process.env.VERCEL ? 'vercel' : process.env.NODE_ENV === 'development' ? 'local' : 'unknown',
    region,
    deploymentId,
    runtime,
  }
}

async function logToolFinish(args: {
  event: {
    toolCall?: {
      toolName?: string
      toolCallId?: string
    }
    success: boolean
    durationMs?: number
    error?: unknown
  }
  automation: AutomationSummary
  conversationId: Id<'conversations'>
  turnId: string
  userId: string
  serverSecret: string
  onEvent?: ExecuteAutomationConversationTurnArgs['onEvent']
  onHeartbeat?: ExecuteAutomationConversationTurnArgs['onHeartbeat']
}) {
  const { event, automation, conversationId, turnId, userId, serverSecret, onEvent, onHeartbeat } = args
  if (!event.toolCall?.toolName) return

  fireAndForgetRecordToolInvocation({
    serverSecret,
    userId,
    toolName: event.toolCall.toolName,
    mode: 'act',
    modelId: automation.modelId,
    conversationId,
    turnId,
    success: event.success,
    durationMs: event.durationMs,
    error: event.error,
  })
  await onHeartbeat?.('running')
  await onEvent?.({
    stage: 'running',
    level: event.success ? 'info' : 'error',
    message: event.success
      ? `Tool ${event.toolCall.toolName} completed.`
      : `Tool ${event.toolCall.toolName} failed.`,
    metadata: {
      toolCallId: event.toolCall.toolCallId,
      toolName: event.toolCall.toolName,
      durationMs: event.durationMs,
      ...(event.success ? {} : { error: clampErrorMessage(event.error) }),
    },
  })
}

async function logStepFinish(args: {
  step: {
    stepNumber?: number
  }
  onEvent?: ExecuteAutomationConversationTurnArgs['onEvent']
  onHeartbeat?: ExecuteAutomationConversationTurnArgs['onHeartbeat']
}) {
  await args.onHeartbeat?.('running')
  await args.onEvent?.({
    stage: 'running',
    level: 'info',
    message: 'Automation model step finished.',
    metadata: { stepNumber: args.step.stepNumber },
  })
}

export async function executeAutomationConversationTurn(
  args: ExecuteAutomationConversationTurnArgs,
): Promise<{ turnId: string; summary?: string; assistantMessage: string }> {
  const {
    automation,
    baseUrl,
    conversationId,
    prompt,
    turnId,
    userId,
    serverSecret,
    requestId,
    executor,
    onEvent,
    onHeartbeat,
  } = args

  await convex.mutation(
    'conversations:addMessage',
    {
      conversationId,
      userId,
      serverSecret,
      turnId,
      role: 'user',
      mode: automation.mode === 'ask' ? 'act' : automation.mode,
      content: prompt,
      contentType: 'text',
      parts: [{ type: 'text', text: prompt }],
      modelId: automation.modelId,
    },
    { throwOnError: true },
  )

  const languageModel = await getGatewayLanguageModel(automation.modelId)
  const composioRaw = await createBrowserUnifiedTools({ userId })
  const [perplexityTool, parallelTool] = await Promise.all([
    getGatewayPerplexitySearchTool(undefined, automation.modelId),
    getGatewayParallelSearchTool(undefined, automation.modelId),
  ])
  const overlayTools = createWebTools({
    userId,
    serverSecret,
    conversationId,
    turnId,
    baseUrl,
  })
  const composioTools = filterComposioToolSet(composioRaw)
  const tools = {
    ...composioTools,
    ...overlayTools,
    ...(perplexityTool ? { perplexity_search: perplexityTool } : {}),
    ...(parallelTool ? { parallel_search: parallelTool } : {}),
  }

  const modelMessages = await convertToModelMessages([buildAutomationUserMessage(prompt, turnId)])

  await onEvent?.({
    stage: 'running',
    level: 'info',
    message: 'Automation execution started.',
    metadata: { requestId, executor },
  })

  let result: Awaited<ReturnType<ToolLoopAgent['generate']>>
  try {
    result = await new ToolLoopAgent({
      model: languageModel,
      tools,
      stopWhen: stepCountIs(MAX_TOOL_STEPS_ACT),
      instructions: buildActInstructions(),
    }).generate({
      messages: modelMessages,
      experimental_onToolCallFinish: async (event) =>
        logToolFinish({
          event,
          automation,
          conversationId,
          turnId,
          userId,
          serverSecret,
          onEvent,
          onHeartbeat,
        }),
      onStepFinish: async (step) => logStepFinish({ step, onEvent, onHeartbeat }),
    })
  } catch (error) {
    throw automationExecutionError(clampErrorMessage(error), 'execute_model', turnId)
  }

  await onHeartbeat?.('persisting')
  await onEvent?.({
    stage: 'persisting',
    level: 'info',
    message: 'Persisting assistant result for the automation run.',
  })

  const { content, parts } = buildAssistantPersistenceFromSteps(result.steps, result.text)

  try {
    await convex.mutation(
      'conversations:addMessage',
      {
        conversationId,
        userId,
        serverSecret,
        turnId,
        role: 'assistant',
        mode: automation.mode === 'ask' ? 'act' : automation.mode,
        content,
        contentType: 'text',
        parts: parts as never,
        modelId: automation.modelId,
        tokens: {
          input: result.totalUsage?.inputTokens ?? result.usage?.inputTokens ?? 0,
          output: result.totalUsage?.outputTokens ?? result.usage?.outputTokens ?? 0,
        },
      },
      { throwOnError: true },
    )
  } catch (error) {
    throw automationExecutionError(clampErrorMessage(error), 'persist_assistant', turnId)
  }

  try {
    await recordAutomationUsage({
      userId,
      serverSecret,
      modelId: automation.modelId,
      usage: result.totalUsage ?? result.usage,
    })
  } catch {
    // Usage logging is audit-only and must not convert a successful run into a silent failure.
  }

  return {
    turnId,
    summary: summarizeAssistantMessage(content),
    assistantMessage: content,
  }
}
