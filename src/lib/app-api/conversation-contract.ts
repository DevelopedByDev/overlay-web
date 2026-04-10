export type AppConversationMode = "ask" | "act";
export type AppConversationRole = "user" | "assistant";
export type AppConversationContentType = "text" | "image" | "video";

export interface AppConversationSummary {
  _id: string;
  userId: string;
  clientId?: string;
  title: string;
  lastModified: number;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
  lastMode: AppConversationMode;
  askModelIds: string[];
  actModelId: string;
  projectId?: string;
}

export type AppConversationMessagePart =
  | {
      type: "text" | "file";
      text?: string;
      url?: string;
      mediaType?: string;
      fileName?: string;
      state?: string;
    }
  | {
      type: "tool-invocation";
      toolInvocation: {
        toolCallId?: string;
        toolName: string;
        state?: string;
        toolInput?: Record<string, unknown>;
        toolOutput?: unknown;
      };
    };

export interface AppConversationMessage {
  id: string;
  turnId: string;
  mode: AppConversationMode;
  contentType: AppConversationContentType;
  variantIndex?: number;
  role: AppConversationRole;
  parts: AppConversationMessagePart[];
  model?: string;
  replyToTurnId?: string;
  replySnippet?: string;
  routedModelId?: string;
}

export interface AppConversationListFilters {
  updatedSince?: number;
  includeDeleted?: boolean;
  projectId?: string;
}

export interface AppCreateConversationInput {
  userId: string;
  serverSecret: string;
  title?: string;
  projectId?: string;
  askModelIds?: string[];
  actModelId?: string;
  lastMode?: AppConversationMode;
  clientId?: string;
}

export interface AppUpdateConversationInput {
  userId: string;
  serverSecret: string;
  conversationId: string;
  title?: string;
  projectId?: string;
  askModelIds?: string[];
  actModelId?: string;
  lastMode?: AppConversationMode;
}

export interface AppCreateConversationResult {
  id: string;
  conversation: AppConversationSummary | null;
}

export interface AppUpdateConversationResult {
  success: true;
  conversation: AppConversationSummary | null;
}

export interface AppDeleteConversationResult {
  success: true;
  conversationId: string;
  deletedAt: number;
}

export interface AppPersistConversationMessageInput {
  userId: string;
  serverSecret: string;
  conversationId: string;
  turnId: string;
  mode?: AppConversationMode;
  role: AppConversationRole;
  content?: string;
  parts?: Array<{
    type: string;
    text?: string;
    url?: string;
    mediaType?: string;
  }>;
  attachmentNames?: string[];
  model?: string;
  modelId?: string;
  contentType?: AppConversationContentType;
  variantIndex?: number;
  replyToTurnId?: string;
  replySnippet?: string;
}

export interface AppDeleteConversationMessageInput {
  userId: string;
  serverSecret: string;
  conversationId: string;
  turnId: string;
}

export interface AppPersistConversationMessageResult {
  success: true;
  conversationId: string;
  turnId: string;
}

export function readOptionalBooleanParam(
  value: string | null,
): boolean | undefined {
  if (value == null) return undefined;
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  return undefined;
}
