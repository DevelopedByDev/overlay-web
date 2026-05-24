import { z } from 'zod'
import { AuthFields, BooleanQueryValue, IdQuery, IntegerQueryValue, PaginationQuery, UnknownResponse } from './common'

export const ConversationListQuery = PaginationQuery.extend({
  conversationId: IdQuery,
  messages: BooleanQueryValue,
  projectId: IdQuery,
  updatedSince: IntegerQueryValue,
  includeDeleted: BooleanQueryValue,
  beforeCreatedAt: IntegerQueryValue,
  compactToolPayloads: BooleanQueryValue,
})

export const CreateConversationRequest = z.object({
  ...AuthFields,
  title: z.string().min(1).max(200).optional(),
  projectId: z.string().optional(),
  askModelIds: z.array(z.string()).optional(),
  actModelId: z.string().optional(),
  lastMode: z.enum(['ask', 'act']).optional(),
  clientId: z.string().optional(),
})

export const UpdateConversationRequest = CreateConversationRequest.partial().extend({
  ...AuthFields,
  conversationId: z.string().min(1),
})

export const DeleteConversationRequest = z.object({
  ...AuthFields,
  conversationId: z.string().min(1).optional(),
})

export const AddConversationMessageRequest = z.object({
  ...AuthFields,
  conversationId: z.string().min(1),
  content: z.string().optional(),
  role: z.string().optional(),
  message: z.unknown().optional(),
}).passthrough()

export const DeleteConversationMessageRequest = z.object({
  ...AuthFields,
  conversationId: z.string().min(1),
  messageId: z.string().min(1).optional(),
  turnId: z.string().min(1).optional(),
}).passthrough()

export const StopConversationRequest = z.object({
  ...AuthFields,
  conversationId: z.string().min(1),
})

export const StreamAuthRequest = z.object({
  ...AuthFields,
  conversationId: z.string().min(1).optional(),
}).passthrough()

export const ShareConversationRequest = z.object({
  ...AuthFields,
  conversationId: z.string().min(1),
  visibility: z.enum(['private', 'public']).optional(),
}).passthrough()

export const ActConversationRequest = z.object({
  ...AuthFields,
  conversationId: z.string().optional(),
  messages: z.array(z.unknown()).optional(),
  prompt: z.string().optional(),
}).passthrough()

export const ChatSuggestionQuery = z.object({})

export const GenerateTitleRequest = z.object({
  ...AuthFields,
  conversationId: z.string().optional(),
  messages: z.array(z.unknown()).optional(),
  prompt: z.string().optional(),
}).passthrough()

export const GenerateMediaRequest = z.object({
  ...AuthFields,
  prompt: z.string().min(1).optional(),
}).passthrough()

export const GenerateTabGroupLabelRequest = z.object({
  ...AuthFields,
  tabs: z.array(z.unknown()).optional(),
}).passthrough()

export const ChatResponse = UnknownResponse

export type CreateConversationRequest = z.infer<typeof CreateConversationRequest>
