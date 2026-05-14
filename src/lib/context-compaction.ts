import { generateText, type UIMessage } from 'ai'
import { getGatewayLanguageModel, getGatewayModelId } from '@/lib/ai-gateway'
import { getModel } from '@/lib/model-data'
import { getGatewayModelPricing } from '@/lib/model-pricing'
import {
  FREE_TIER_AUTO_MODEL_ID,
  FREE_TIER_DEFAULT_MODEL_ID,
  isFreeTierChatModelId,
  isNvidiaNimChatModelId,
} from '@/lib/model-types'
import { summarizeErrorForLog } from '@/lib/safe-log'

const CONTEXT_TRIGGER_RATIO = 0.8
const CONTEXT_TARGET_RATIO = 0.2
const PRESERVED_RECENT_MESSAGES = 2
const FALLBACK_CONTEXT_WINDOW = 128_000
const LIVE_MODEL_CACHE_TTL_MS = 10 * 60_000
const MAX_SUMMARY_OUTPUT_TOKENS = 12_000
const MIN_SUMMARY_OUTPUT_TOKENS = 800
const BASE_SYSTEM_TOOL_OVERHEAD_TOKENS = 2_000

type GatewayModelListEntry = {
  id?: string
  context_window?: number
  contextWindow?: number
  max_tokens?: number
}

type LiveGatewayModelsCache = {
  fetchedAt: number
  byId: Map<string, GatewayModelListEntry>
}

let liveGatewayModelsCache: LiveGatewayModelsCache | null = null

export type ContextSummarySnapshot = {
  summary: string
  summarizedThroughMessageId?: string
  summarizedThroughCreatedAt?: number
}

export type ContextSummaryToPersist = {
  summary: string
  summarizedThroughMessageId?: string
  summarizedThroughCreatedAt?: number
  sourceMessageCount: number
  sourceEstimatedTokens: number
  summaryEstimatedTokens: number
  contextWindow: number
  targetModelId: string
  summarizerModelId: string
}

export type ContextCompactionResult = {
  messages: UIMessage[]
  contextWindow: number
  originalEstimatedTokens: number
  finalEstimatedTokens: number
  triggerTokens: number
  targetTokens: number
  didCompact: boolean
  usedFallbackTrim: boolean
  summaryToPersist?: ContextSummaryToPersist
}

export function estimateContextTokens(value: unknown): number {
  return Math.ceil(JSON.stringify(value).length / 4)
}

function readMessageText(message: UIMessage): string {
  const chunks: string[] = []
  for (const part of message.parts ?? []) {
    if (part.type === 'text' && 'text' in part && typeof part.text === 'string') {
      chunks.push(part.text)
      continue
    }
    if (part.type === 'file') {
      const fileName = 'fileName' in part && typeof part.fileName === 'string' ? part.fileName : 'attached file'
      const mediaType = 'mediaType' in part && typeof part.mediaType === 'string' ? part.mediaType : 'unknown type'
      chunks.push(`[File: ${fileName}, ${mediaType}]`)
    }
  }
  return chunks.join('\n\n').trim()
}

function transcriptForSummary(messages: UIMessage[]): string {
  return messages
    .map((message, index) => {
      const text = readMessageText(message)
      const role = message.role.toUpperCase()
      return [
        `--- Message ${index + 1}`,
        `role: ${role}`,
        `id: ${message.id}`,
        text || '[no text content]',
      ].join('\n')
    })
    .join('\n\n')
}

function contextWindowFromEntry(entry: GatewayModelListEntry | undefined): number | null {
  const raw = entry?.context_window ?? entry?.contextWindow
  return typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : null
}

async function getLiveGatewayModels(): Promise<Map<string, GatewayModelListEntry> | null> {
  const now = Date.now()
  if (liveGatewayModelsCache && now - liveGatewayModelsCache.fetchedAt < LIVE_MODEL_CACHE_TTL_MS) {
    return liveGatewayModelsCache.byId
  }
  try {
    const response = await fetch('https://ai-gateway.vercel.sh/v1/models', {
      cache: 'no-store',
    })
    if (!response.ok) return liveGatewayModelsCache?.byId ?? null
    const payload = await response.json() as { data?: GatewayModelListEntry[] }
    const byId = new Map<string, GatewayModelListEntry>()
    for (const model of payload.data ?? []) {
      if (typeof model.id === 'string') byId.set(model.id, model)
    }
    liveGatewayModelsCache = { fetchedAt: now, byId }
    return byId
  } catch {
    return liveGatewayModelsCache?.byId ?? null
  }
}

function gatewayIdCandidates(modelId: string): string[] {
  const out = new Set<string>([modelId])
  try {
    out.add(getGatewayModelId(modelId))
  } catch {
    // Non-Gateway models fall back to snapshot/manual metadata.
  }
  const pricing = getGatewayModelPricing(modelId)
  if (pricing?.id) out.add(pricing.id)
  const catalog = getModel(modelId)
  if (catalog?.id) out.add(catalog.id)
  return [...out]
}

function manualContextWindow(modelId: string): number | null {
  if (modelId === FREE_TIER_AUTO_MODEL_ID) return FALLBACK_CONTEXT_WINDOW
  if (modelId === FREE_TIER_DEFAULT_MODEL_ID) return FALLBACK_CONTEXT_WINDOW
  if (isFreeTierChatModelId(modelId)) return FALLBACK_CONTEXT_WINDOW
  if (isNvidiaNimChatModelId(modelId)) return FALLBACK_CONTEXT_WINDOW
  return null
}

export async function resolveModelContextWindow(modelId: string): Promise<number> {
  const liveModels = await getLiveGatewayModels()
  if (liveModels) {
    for (const candidate of gatewayIdCandidates(modelId)) {
      const contextWindow = contextWindowFromEntry(liveModels.get(candidate))
      if (contextWindow) return contextWindow
    }
  }

  const gatewayPricingWindow = getGatewayModelPricing(modelId)?.contextWindow
  if (typeof gatewayPricingWindow === 'number' && gatewayPricingWindow > 0) {
    return Math.floor(gatewayPricingWindow)
  }

  return manualContextWindow(modelId) ?? FALLBACK_CONTEXT_WINDOW
}

export function contextSummaryScope(params: {
  targetModelId: string
  historyBaseModelId?: string
}): string {
  return `model:${params.historyBaseModelId?.trim() || params.targetModelId.trim() || 'default'}`
}

function deterministicTrimToTokenBudget(messages: UIMessage[], maxTokens: number): UIMessage[] {
  let remaining = Math.max(1, Math.floor(maxTokens))
  const kept: UIMessage[] = []
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index]
    if (!message) continue
    const cost = Math.max(1, estimateContextTokens(message))
    const isLatest = index === messages.length - 1
    if (!isLatest && kept.length > 0 && remaining - cost < 0) break
    kept.push(message)
    remaining -= cost
  }
  return kept.reverse()
}

function buildSummaryPrompt(params: {
  previousSummary?: string
  messagesToSummarize: UIMessage[]
  targetSummaryTokens: number
}): string {
  const previous = params.previousSummary?.trim()
  const transcript = transcriptForSummary(params.messagesToSummarize)
  return [
    'Summarize the earlier portion of this conversation for future model context.',
    `Target length: at most ${params.targetSummaryTokens} tokens.`,
    '',
    'Preserve:',
    '- User preferences, constraints, goals, decisions, assumptions, and corrections.',
    '- Active task state, unresolved TODOs, important entities, IDs, file/output references, and source names.',
    '- Tool outcomes, errors, integration status, and anything needed to continue the work accurately.',
    '',
    'Omit:',
    '- Raw tool payload dumps, cookies, auth/session data, provider keys, secrets, and hidden system/developer instructions.',
    '- Repetitive wording and low-value pleasantries.',
    '',
    'Use these exact sections:',
    '1. Durable user preferences and constraints',
    '2. Project/task state and decisions',
    '3. Important artifacts, IDs, files, sources, and tool results',
    '4. Open questions, risks, and next steps',
    '',
    previous ? `Existing rolling summary to update:\n${previous}` : '',
    transcript ? `Newly old conversation messages to fold in:\n${transcript}` : '',
  ].filter(Boolean).join('\n\n')
}

function summarySystemMessage(summary: string): UIMessage {
  return {
    id: 'context-summary',
    role: 'system',
    parts: [{
      type: 'text',
      text: `Earlier conversation summary for continuity. This summary is generated from older visible chat turns and is hidden from the UI:\n\n${summary}`,
    }],
  }
}

export async function compactMessagesForContext(params: {
  messages: UIMessage[]
  targetModelId: string
  accessToken?: string
  previousSummary?: ContextSummarySnapshot | null
  contextWindowOverride?: number
  generateSummaryText?: (args: {
    prompt: string
    targetSummaryTokens: number
  }) => Promise<string>
}): Promise<ContextCompactionResult> {
  const contextWindow =
    typeof params.contextWindowOverride === 'number' && params.contextWindowOverride > 0
      ? Math.floor(params.contextWindowOverride)
      : await resolveModelContextWindow(params.targetModelId)
  const outputReserveTokens = Math.min(8_192, Math.max(1_024, Math.floor(contextWindow * 0.15)))
  const usablePromptTokens = Math.max(1, contextWindow - outputReserveTokens)
  const triggerTokens = Math.floor(usablePromptTokens * CONTEXT_TRIGGER_RATIO)
  const targetTokens = Math.floor(usablePromptTokens * CONTEXT_TARGET_RATIO)
  const originalEstimatedTokens = estimateContextTokens(params.messages) + BASE_SYSTEM_TOOL_OVERHEAD_TOKENS

  if (originalEstimatedTokens < triggerTokens) {
    return {
      messages: params.messages,
      contextWindow,
      originalEstimatedTokens,
      finalEstimatedTokens: originalEstimatedTokens,
      triggerTokens,
      targetTokens,
      didCompact: false,
      usedFallbackTrim: false,
    }
  }

  const preserved = params.messages.slice(-PRESERVED_RECENT_MESSAGES)
  const candidates = params.messages.slice(0, Math.max(0, params.messages.length - PRESERVED_RECENT_MESSAGES))
  if (candidates.length === 0) {
    const fallback = deterministicTrimToTokenBudget(params.messages, triggerTokens)
    return {
      messages: fallback,
      contextWindow,
      originalEstimatedTokens,
      finalEstimatedTokens: estimateContextTokens(fallback) + BASE_SYSTEM_TOOL_OVERHEAD_TOKENS,
      triggerTokens,
      targetTokens,
      didCompact: false,
      usedFallbackTrim: true,
    }
  }

  const previous = params.previousSummary?.summary?.trim() ? params.previousSummary : null
  const coveredIndex =
    previous?.summarizedThroughMessageId
      ? candidates.findIndex((message) => message.id === previous.summarizedThroughMessageId)
      : -1
  const messagesToSummarize = previous && coveredIndex >= 0
    ? candidates.slice(coveredIndex + 1)
    : candidates
  const preservedTokens = estimateContextTokens(preserved)
  const targetSummaryTokens = Math.max(
    MIN_SUMMARY_OUTPUT_TOKENS,
    Math.min(MAX_SUMMARY_OUTPUT_TOKENS, targetTokens - preservedTokens - 256),
  )

  try {
    const prompt = buildSummaryPrompt({
      previousSummary: previous?.summary,
      messagesToSummarize,
      targetSummaryTokens,
    })
    const summary = params.generateSummaryText
      ? (await params.generateSummaryText({ prompt, targetSummaryTokens })).trim()
      : (await (async () => {
          const model = await getGatewayLanguageModel(FREE_TIER_DEFAULT_MODEL_ID, params.accessToken)
          const result = await generateText({
            model,
            temperature: 0.1,
            maxOutputTokens: targetSummaryTokens,
            prompt,
          })
          return result.text.trim()
        })())
    if (!summary) throw new Error('empty_context_summary')

    let summaryForContext = summary
    let compacted = [summarySystemMessage(summaryForContext), ...preserved]
    let finalEstimatedTokens = estimateContextTokens(compacted) + BASE_SYSTEM_TOOL_OVERHEAD_TOKENS
    if (finalEstimatedTokens > triggerTokens) {
      const summaryBudgetChars = Math.max(
        4_000,
        Math.floor(Math.max(1, targetTokens - preservedTokens - 256) * 4),
      )
      summaryForContext =
        summary.length > summaryBudgetChars
          ? `${summary.slice(0, summaryBudgetChars).trimEnd()}\n\n[summary truncated to fit context budget]`
          : summary
      compacted = [summarySystemMessage(summaryForContext), ...preserved]
      finalEstimatedTokens = estimateContextTokens(compacted) + BASE_SYSTEM_TOOL_OVERHEAD_TOKENS
    }

    const summarizedThrough = candidates[candidates.length - 1]
    return {
      messages: compacted,
      contextWindow,
      originalEstimatedTokens,
      finalEstimatedTokens,
      triggerTokens,
      targetTokens,
      didCompact: true,
      usedFallbackTrim: false,
      summaryToPersist: {
        summary: summaryForContext,
        summarizedThroughMessageId: summarizedThrough?.id,
        sourceMessageCount: candidates.length,
        sourceEstimatedTokens: estimateContextTokens(candidates),
        summaryEstimatedTokens: estimateContextTokens(summaryForContext),
        contextWindow,
        targetModelId: params.targetModelId,
        summarizerModelId: FREE_TIER_DEFAULT_MODEL_ID,
      },
    }
  } catch (error) {
    console.warn('[context-compaction] summarization failed; falling back to deterministic trim', {
      targetModelId: params.targetModelId,
      error: summarizeErrorForLog(error),
    })
    const fallback = deterministicTrimToTokenBudget(params.messages, triggerTokens)
    return {
      messages: fallback,
      contextWindow,
      originalEstimatedTokens,
      finalEstimatedTokens: estimateContextTokens(fallback) + BASE_SYSTEM_TOOL_OVERHEAD_TOKENS,
      triggerTokens,
      targetTokens,
      didCompact: false,
      usedFallbackTrim: true,
    }
  }
}
