export interface ConversationSummary {
  _id: string
  title: string
  lastModified: number
  createdAt: number
  updatedAt: number
  deletedAt?: number
  lastMode: 'ask' | 'act'
  askModelIds: string[]
  actModelId: string
  clientId?: string
  projectId?: string
}

export type ConversationMessagePart =
  | { type: 'text'; text?: string }
  | { type: 'file'; url?: string; mediaType?: string; fileName?: string }
  | {
      type: 'tool-invocation'
      toolInvocation: {
        toolCallId?: string
        toolName: string
        state?: string
        toolInput?: Record<string, unknown>
        toolOutput?: unknown
      }
    }

export interface ConversationMessage {
  id: string
  turnId: string
  mode: 'ask' | 'act'
  contentType: 'text' | 'image' | 'video'
  variantIndex?: number
  role: 'user' | 'assistant'
  parts: ConversationMessagePart[]
  model?: string
  replyToTurnId?: string
  replySnippet?: string
  routedModelId?: string
}
