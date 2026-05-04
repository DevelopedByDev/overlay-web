import type { UIMessage } from 'ai'
import type { Chat } from '@ai-sdk/react'
import type { SourceCitationMap } from '@/lib/ask-knowledge-context'
import type { OutputType } from '@/lib/output-types'
import type { AutomationDraftSummary } from '@/lib/automation-drafts'
import type { SkillDraftSummary } from '@/lib/skill-drafts'
import type { Id } from '../../../../convex/_generated/dataModel'

export interface Conversation {
  _id: string
  title: string
  lastModified: number
  createdAt?: number
  updatedAt?: number
  lastMode?: 'ask' | 'act'
  askModelIds?: string[]
  modelIds?: string[]
  actModelId?: string
}

export interface AttachedImage {
  dataUrl: string
  mimeType: string
  name: string
}

export interface PendingChatDocument {
  clientId: string
  name: string
  /** Convex file row ids (all parts when a long upload was split). */
  fileIds: string[]
  status: 'uploading' | 'ready' | 'error'
  error?: string
}

export interface ChatOutput {
  _id: string
  type: OutputType
  status: 'pending' | 'completed' | 'failed'
  prompt: string
  modelId: string
  url?: string
  createdAt: number
  turnId?: string
}

export interface Entitlements {
  tier: 'free' | 'pro' | 'max'
  planKind?: 'free' | 'paid'
  creditsUsed: number
  creditsTotal: number
  budgetUsedCents?: number
  budgetTotalCents?: number
  budgetRemainingCents?: number
  autoTopUpEnabled?: boolean
  topUpAmountCents?: number
  autoTopUpAmountCents?: number
  topUpMinAmountCents?: number
  topUpMaxAmountCents?: number
  topUpStepAmountCents?: number
  dailyUsage: { ask: number; write: number; agent: number }
  dailyLimits: { ask: number; write: number; agent: number }
}

export type AssistantVisualBlock =
  | {
      kind: 'tool'
      key: string
      name: string
      state: string
      toolInput?: Record<string, unknown>
      toolOutput?: unknown
    }
  | { kind: 'text'; text: string }
  | { kind: 'file'; url: string; mediaType?: string }
  | { kind: 'reasoning'; key: string; text: string; state?: string }

export type ToolVisualBlock = Extract<AssistantVisualBlock, { kind: 'tool' }>

export type AssistantVisualSegment =
  | { kind: 'reasoning'; block: Extract<AssistantVisualBlock, { kind: 'reasoning' }>; originIndex: number }
  | { kind: 'text'; block: Extract<AssistantVisualBlock, { kind: 'text' }>; originIndex: number }
  | { kind: 'file'; block: Extract<AssistantVisualBlock, { kind: 'file' }>; originIndex: number }
  | { kind: 'browser'; block: ToolVisualBlock; originIndex: number }
  | { kind: 'tools'; tools: ToolVisualBlock[]; originIndex: number }

export interface ChatMessageMetadata {
  indexedDocuments?: string[]
  indexedAttachments?: { name: string; fileIds: string[] }[]
  replyToTurnId?: string
  replySnippet?: string
  sourceCitations?: SourceCitationMap
  routedModelId?: string
}

export type DraftModalState = {
  kind: 'skill'
  draft: SkillDraftSummary
} | {
  kind: 'automation'
  draft: AutomationDraftSummary
}

export type ServerConversationMessage = {
  id: string
  turnId?: string
  role: 'user' | 'assistant'
  parts: Array<{
    type: string
    text?: string
    url?: string
    mediaType?: string
    fileName?: string
    state?: string
  }>
  model?: string
  metadata?: ChatMessageMetadata
  replyToTurnId?: string
  replySnippet?: string
  routedModelId?: string
}

export type LiveConversationMessage = {
  _id: Id<'conversationMessages'>
  turnId: string
  role: 'user' | 'assistant'
  mode: 'ask' | 'act'
  content: string
  contentType: 'text' | 'image' | 'video'
  parts?: Array<Record<string, unknown>>
  modelId?: string
  variantIndex?: number
  routedModelId?: string
  status?: 'generating' | 'completed' | 'error'
}

export type LiveMessageDelta = {
  _id: Id<'conversationMessageDeltas'>
  messageId: Id<'conversationMessages'>
  textDelta?: string
  newParts?: Array<Record<string, unknown>>
}

export interface GenerationResult {
  type: 'image' | 'video'
  status: 'generating' | 'completed' | 'failed'
  url?: string
  modelUsed?: string
  outputId?: string
  error?: string
  upgradeRequired?: boolean
}

export type AskModelSelectionMode = 'single' | 'multiple'

export interface ConversationUiState {
  selectedActModel: string
  selectedModels: string[]
  askModelSelectionMode: AskModelSelectionMode
  exchangeModes: ('ask' | 'act')[]
  exchangeModels: string[][]
  selectedTabPerExchange: number[]
  activeChatTitle: string | null
  generationResults: Map<number, GenerationResult[]>
  exchangeGenTypes: ('text' | 'image' | 'video')[]
  isFirstMessage: boolean
  orphanModelThreads: Map<string, UIMessage[]>
  lastGeneratedImageUrl: string | null
}

export interface ConversationRuntime {
  askChats: [Chat<UIMessage>, Chat<UIMessage>, Chat<UIMessage>, Chat<UIMessage>]
  actChat: Chat<UIMessage>
  hydrated: boolean
  ui: ConversationUiState
}

export interface RestoredOutputGroup {
  type: 'image' | 'video'
  prompt: string
  modelIds: string[]
  results: GenerationResult[]
  createdAt: number
  turnId?: string | null
}
