import 'server-only'

import type { UIMessage } from '@/server/ai/sdk'
import type { ContextSummarySnapshot } from '@/server/chat/context-compaction'
import type { AppSettings, Entitlements } from '@/shared/app/app-contracts'
import type { Id } from '../../../convex/_generated/dataModel'

export type ActPersistedMessage = {
  _id: string
  turnId: string
  role: 'user' | 'assistant'
  modelId?: string
  content: string
  parts?: UIMessage['parts']
  routedModelId?: string
}

export type ActMemoryRow = {
  content: string
  importance?: number
  updatedAt?: number
}

export type ActSkillRow = {
  name: string
  instructions: string
  enabled?: boolean
}

export type ActConversationRow = {
  projectId?: string
}

export type ActProjectRow = {
  instructions?: string
}

export type ActUsageEvent = {
  type: 'agent'
  modelId: string
  inputTokens: number
  outputTokens: number
  cachedTokens: number
  cost: number
  timestamp: number
}

export interface ActConversationRepository {
  getEntitlements(args: {
    userId: string
  }): Promise<Entitlements | null>
  getAppSettings(args: {
    userId: string
  }): Promise<AppSettings | null>
  getMessages(args: {
    conversationId: Id<'conversations'>
    userId: string
  }): Promise<ActPersistedMessage[]>
  addMessage(args: {
    conversationId: Id<'conversations'>
    content: string
    contentType: 'text'
    mode: 'act'
    modelId: string
    parts?: Array<Record<string, unknown>>
    role: 'user' | 'assistant'
    routedModelId?: string
    tokens?: { input: number; output: number }
    turnId: string
    userId: string
    variantIndex?: number
  }): Promise<Id<'conversationMessages'> | null>
  listMemories(args: {
    userId: string
  }): Promise<ActMemoryRow[] | null>
  listSkills(args: {
    userId: string
  }): Promise<ActSkillRow[]>
  getConversation(args: {
    conversationId: Id<'conversations'>
    userId: string
  }): Promise<ActConversationRow | null>
  getProject(args: {
    projectId: Id<'projects'>
    userId: string
  }): Promise<ActProjectRow | null>
  getContextSummary(args: {
    conversationId: Id<'conversations'>
    scope: string
    userId: string
  }): Promise<ContextSummarySnapshot | null>
  upsertContextSummary(args: {
    contextWindow: number
    conversationId: Id<'conversations'>
    scope: string
    sourceEstimatedTokens: number
    sourceMessageCount: number
    summarizedThroughCreatedAt?: number
    summarizedThroughMessageId?: string
    summarizerModelId: string
    summary: string
    summaryEstimatedTokens: number
    targetModelId: string
    userId: string
  }): Promise<void>
  startGeneratingMessage(args: {
    conversationId: Id<'conversations'>
    mode: 'act'
    modelId: string
    turnId: string
    userId: string
    variantIndex?: number
  }): Promise<Id<'conversationMessages'> | null>
  appendGeneratingMessageDelta(args: {
    messageId: Id<'conversationMessages'>
    newParts?: Array<Record<string, unknown>>
    textDelta?: string
  }): Promise<void>
  finalizeGeneratingMessage(args: {
    content: string
    messageId: Id<'conversationMessages'>
    parts: Array<Record<string, unknown>>
    routedModelId?: string
    tokens: { input: number; output: number }
  }): Promise<void>
  failGeneratingMessage(args: {
    errorText: string
    messageId: Id<'conversationMessages'>
  }): Promise<void>
  recordUsageBatch(args: {
    events: ActUsageEvent[]
    forceFreeTierLimits: boolean
    userId: string
  }): Promise<void>
}
