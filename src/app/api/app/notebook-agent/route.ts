import { NextRequest } from 'next/server'
import { ToolLoopAgent, stepCountIs, tool, type ToolSet } from 'ai'
import { z } from 'zod'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import { convex } from '@/lib/convex'
import { getGatewayLanguageModel } from '@/lib/ai-gateway'
import { resolveAuthenticatedAppUser } from '@/lib/app-api-auth'
import type { Entitlements } from '@/lib/app-contracts'
import {
  billableBudgetCentsFromProviderUsd,
  buildInsufficientCreditsPayload,
  ensureBudgetAvailable,
  getBudgetTotals,
  isPaidPlan,
} from '@/lib/billing-runtime'
import { calculateTokenCost, isPremiumModel } from '@/lib/model-pricing'
import { createNotebookTextEmitter } from '@/lib/notebook-agent-stream'
import {
  DEFAULT_MODEL_ID,
  FREE_TIER_AUTO_MODEL_ID,
  isNvidiaNimChatModelId,
} from '@/lib/models'
import { getInternalApiBaseUrl } from '@/lib/url'
import { executeSearchKnowledge } from '@/lib/tools/overlay-executes'
import type { OverlayToolsOptions } from '@/lib/tools/types'
import type { NotebookEdit, NotebookAgentStreamEvent } from '@/lib/notebook-agent-contract'
import { NOTEBOOK_AGENT_PROMPT } from '@/lib/notebook-agent-prompts'
import { resolveMentionsContext } from '@/lib/mention-resolver'
import { summarizeErrorForLog } from '@/lib/safe-log'
import { enforceRateLimits, getClientIp } from '@/lib/rate-limit'

export const maxDuration = 120

const MAX_NOTE_CHARS = 400_000

const MentionSchema = z.object({
  type: z.string(),
  id: z.string(),
  name: z.string(),
  fileIds: z.array(z.string()).optional(),
})

const BodySchema = z.object({
  noteContent: z.string(),
  noteTitle: z.string(),
  message: z.string().min(1).max(32_000),
  modelId: z.string().optional(),
  mode: z.enum(['ask', 'write']).optional(), // Deprecated: kept for backward compatibility
  projectId: z.string().optional(),
  accessToken: z.string().optional(),
  userId: z.string().optional(),
  mentions: z.array(MentionSchema).optional(),
})

function createNotebookTools(params: {
  frozenNoteLines: string
  noteTitle: string
  emit: (e: NotebookAgentStreamEvent) => void
  toolOptions: OverlayToolsOptions
  createEditId: () => string
}): ToolSet {
  const { frozenNoteLines, noteTitle, emit, toolOptions, createEditId } = params
  const tools: ToolSet = {}

  tools.search_knowledge = tool({
    description:
      "Search the user's saved knowledge: indexed files and memories. Uses hybrid semantic + keyword retrieval. Call when you need facts that are not already in the note text.",
    inputSchema: z.object({
      query: z.string().describe('Search query: keywords or a short natural-language question'),
      sourceKind: z
        .enum(['file', 'memory'])
        .optional()
        .describe('Limit to files only or memories only (omit to search both)'),
    }),
    execute: async (input) => {
      emit({
        type: 'tool_call',
        tool: 'search_knowledge',
        toolInput: input as Record<string, unknown>,
      })
      return executeSearchKnowledge(toolOptions, input)
    },
  })

  tools.read_note = tool({
    description: 'Read note title and content with line numbers.',
    inputSchema: z.object({}),
    execute: async () => {
      emit({ type: 'tool_call', tool: 'read_note', toolInput: {} })
      const title = noteTitle || 'Untitled'
      const lines = frozenNoteLines.split('\n')
      const numbered = lines.map((line, index) => `${index + 1}: ${line}`).join('\n')
      return {
        title,
        lineCount: lines.length,
        content: numbered,
        isEmpty: lines.length === 0 || (lines.length === 1 && lines[0].trim() === ''),
      }
    },
  })

  // Always include propose_edit - the LLM decides when to use it based on user intent
  tools.propose_edit = tool({
    description:
      'Propose replacing a line range with new content. User can accept/reject each edit. Only use this when the user explicitly asks to modify the note.',
    inputSchema: z.object({
      description: z.string().describe('Short edit label'),
      start_line: z.number().describe('First line to replace (1-based)'),
      end_line: z.number().describe('Last line to replace (1-based, inclusive)'),
      new_content: z.string().describe('Replacement content; empty string deletes lines'),
    }),
    execute: async ({ description, start_line, end_line, new_content }) => {
      emit({
        type: 'tool_call',
        tool: 'propose_edit',
        toolInput: {
          description,
          start_line,
          end_line,
          new_content:
            new_content.length > 8000
              ? `${new_content.slice(0, 8000)}\n[truncated in log]`
              : new_content,
        },
      })
      const lines = frozenNoteLines.split('\n')
      const startLine = Math.max(1, Math.round(start_line))
      const endLine = Math.max(startLine, Math.round(end_line))
      const originalLines = lines.slice(startLine - 1, endLine)
      const newLines = new_content === '' ? [] : new_content.split('\n')

      const edit: NotebookEdit = {
        id: createEditId(),
        description,
        startLine,
        endLine,
        originalLines,
        newLines,
      }

      emit({ type: 'edit_proposal', edit })

      return {
        success: true as const,
        editId: edit.id,
        message: `Edit proposed (lines ${startLine}-${endLine})`,
      }
    },
  })

  tools.finish = tool({
    description: 'Signal notebook task completion with a summary.',
    inputSchema: z.object({
      summary: z.string().describe('One sentence summary'),
    }),
    execute: async ({ summary }) => {
      emit({ type: 'tool_call', tool: 'finish', toolInput: { summary } })
      if (summary.trim()) {
        emit({ type: 'text', text: summary })
      }
      return { success: true as const, summary }
    },
  })

  return tools
}

export async function POST(request: NextRequest) {
  let bodyRaw: unknown
  try {
    bodyRaw = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const parsed = BodySchema.safeParse(bodyRaw)
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: 'Invalid request', details: parsed.error.format() }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { noteContent: rawNoteContent, noteTitle, message, modelId, projectId, mentions: rawMentions } = parsed.data

  const auth = await resolveAuthenticatedAppUser(request, {
    accessToken: parsed.data.accessToken,
    userId: parsed.data.userId,
  })
  if (!auth) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const userId = auth.userId
  const rateLimitResponse = await enforceRateLimits(request, [
    { bucket: 'notebook-agent:ip', key: getClientIp(request), limit: 60, windowMs: 10 * 60_000 },
    { bucket: 'notebook-agent:user', key: userId, limit: 30, windowMs: 10 * 60_000 },
  ])
  if (rateLimitResponse) return rateLimitResponse
  const serverSecret = getInternalApiSecret()

  const entitlements = await convex.query<Entitlements>('usage:getEntitlementsByServer', {
    serverSecret,
    userId,
  })
  if (!entitlements) {
    return new Response(
      JSON.stringify({
        error: 'Unauthorized',
        message: 'Could not verify subscription. Try signing out and back in.',
      }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const effectiveModelId = (modelId?.trim() && modelId.trim()) || DEFAULT_MODEL_ID

  if (!isPaidPlan(entitlements)) {
    if (effectiveModelId !== FREE_TIER_AUTO_MODEL_ID && !isNvidiaNimChatModelId(effectiveModelId)) {
      return new Response(
        JSON.stringify({
          error: 'premium_model_not_allowed',
          message:
            'Free tier is limited to Auto and NVIDIA NIM models. Upgrade to a paid plan to use premium models.',
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } },
      )
    }
  } else {
    const budget = getBudgetTotals(entitlements)
    if (budget.remainingCents <= 0 && isPremiumModel(effectiveModelId)) {
      const autoTopUp = await ensureBudgetAvailable({
        userId,
        entitlements,
        minimumRequiredCents: 1,
      })
      if (autoTopUp.remainingCents <= 0) {
        return new Response(
          JSON.stringify(buildInsufficientCreditsPayload(entitlements, 'No budget remaining. Please top up your account.')),
          { status: 402, headers: { 'Content-Type': 'application/json' } },
        )
      }
    }
  }

  const refreshedEntitlements = await convex.query<Entitlements>('usage:getEntitlementsByServer', {
    serverSecret,
    userId,
  })
  if (!refreshedEntitlements) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized', message: 'Could not refresh subscription state.' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    )
  }

  if (isPaidPlan(refreshedEntitlements) && isPremiumModel(effectiveModelId)) {
    const refreshedBudget = getBudgetTotals(refreshedEntitlements)
    if (refreshedBudget.remainingCents <= 0) {
      return new Response(
        JSON.stringify(
          buildInsufficientCreditsPayload(refreshedEntitlements, 'No budget remaining. Please top up your account.'),
        ),
        { status: 402, headers: { 'Content-Type': 'application/json' } },
      )
    }
  }

  const frozenNoteLines =
    rawNoteContent.length > MAX_NOTE_CHARS
      ? `${rawNoteContent.slice(0, MAX_NOTE_CHARS)}\n[Note truncated for agent context]`
      : rawNoteContent

  const forwardCookie = request.headers.get('cookie') ?? undefined
  const toolOptions: OverlayToolsOptions = {
    userId,
    accessToken: auth.accessToken,
    baseUrl: getInternalApiBaseUrl(request),
    forwardCookie,
    projectId,
  }

  const encoder = new TextEncoder()
  let editSeq = 0
  const createEditId = () => `edit-${Date.now()}-${editSeq++}`

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (evt: NotebookAgentStreamEvent) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(evt)}\n`))
      }

      try {
        emit({ type: 'thinking', thinking: 'Analyzing note...' })
        const model = await getGatewayLanguageModel(effectiveModelId, auth.accessToken)
        const mentionsContext = await resolveMentionsContext(rawMentions, {
          userId,
          serverSecret,
        })
        const instructions = NOTEBOOK_AGENT_PROMPT + mentionsContext
        const emitText = createNotebookTextEmitter((text) => {
          emit({ type: 'text', text })
        })
        const tools = createNotebookTools({
          frozenNoteLines,
          noteTitle,
          emit,
          toolOptions,
          createEditId,
        })

        const agent = new ToolLoopAgent({
          model,
          instructions,
          tools,
          stopWhen: stepCountIs(20),
          onStepFinish: async ({ text }) => {
            emitText(text)
          },
        })

        const prompt =
          `Note content:\n\n${frozenNoteLines || '(empty note)'}\n\n---\n\nUser request: ${message}`

        const result = await agent.generate({ prompt })

        emitText(result.text)

        const totalUsage = result.totalUsage
        const totalInputTokens = totalUsage?.inputTokens ?? 0
        const totalOutputTokens = totalUsage?.outputTokens ?? 0
        const providerCostUsd =
          isNvidiaNimChatModelId(effectiveModelId)
            ? 0
            : calculateTokenCost(effectiveModelId, totalInputTokens, 0, totalOutputTokens)
        const costCents = billableBudgetCentsFromProviderUsd(providerCostUsd)

        if (costCents > 0 || totalInputTokens > 0 || totalOutputTokens > 0) {
          try {
            await convex.mutation('usage:recordBatch', {
              serverSecret,
              userId,
              events: [
                {
                  type: 'agent',
                  modelId: effectiveModelId,
                  inputTokens: totalInputTokens,
                  outputTokens: totalOutputTokens,
                  cachedTokens: totalUsage?.inputTokenDetails?.cacheReadTokens ?? 0,
                  cost: costCents,
                  timestamp: Date.now(),
                },
              ],
            })
          } catch (err) {
            console.error('[notebook-agent] Failed to record usage:', summarizeErrorForLog(err))
            throw err
          }
        }

        emit({ type: 'done' })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[notebook-agent]', summarizeErrorForLog(err))
        emit({ type: 'error', error: msg })
        emit({ type: 'done' })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}
