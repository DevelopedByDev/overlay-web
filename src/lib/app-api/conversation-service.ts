import {
  buildPersistedMessageContent,
  sanitizeMessagePartsForPersistence,
} from "@/lib/chat-message-persistence";
import { convex } from "@/lib/convex";
import { DEFAULT_MODEL_ID, FREE_TIER_AUTO_MODEL_ID } from "@/lib/models";
import type {
  AppConversationListFilters,
  AppConversationMessage,
  AppConversationMessagePart,
  AppConversationSummary,
  AppCreateConversationInput,
  AppCreateConversationResult,
  AppDeleteConversationMessageInput,
  AppDeleteConversationResult,
  AppPersistConversationMessageInput,
  AppPersistConversationMessageResult,
  AppUpdateConversationInput,
  AppUpdateConversationResult,
} from "@/lib/app-api/conversation-contract";
import type { Id } from "../../../convex/_generated/dataModel";

function toApiConversationMessagePart(
  part:
    | {
        type: string;
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
      },
): AppConversationMessagePart {
  if (
    part.type === "tool-invocation" &&
    "toolInvocation" in part &&
    part.toolInvocation
  ) {
    return {
      type: "tool-invocation",
      toolInvocation: part.toolInvocation,
    };
  }

  return {
    type: part.type === "file" ? "file" : "text",
    text: "text" in part ? part.text : undefined,
    url: "url" in part ? part.url : undefined,
    mediaType: "mediaType" in part ? part.mediaType : undefined,
    fileName: "fileName" in part ? part.fileName : undefined,
    state: "state" in part ? part.state : undefined,
  };
}

function toApiConversationMessage(message: {
  _id: string;
  turnId: string;
  role: "user" | "assistant";
  mode: "ask" | "act";
  content: string;
  contentType: "text" | "image" | "video";
  parts?: Array<
    | {
        type: string;
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
      }
  >;
  modelId?: string;
  variantIndex?: number;
  replyToTurnId?: string;
  replySnippet?: string;
  routedModelId?: string;
}): AppConversationMessage {
  return {
    id: message._id,
    turnId: message.turnId,
    mode: message.mode,
    contentType: message.contentType,
    variantIndex: message.variantIndex,
    role: message.role,
    parts: message.parts?.length
      ? message.parts.map(toApiConversationMessagePart)
      : [{ type: "text", text: message.content }],
    model: message.modelId,
    ...(message.replyToTurnId ? { replyToTurnId: message.replyToTurnId } : {}),
    ...(message.replySnippet ? { replySnippet: message.replySnippet } : {}),
    ...(message.routedModelId ? { routedModelId: message.routedModelId } : {}),
  };
}

export async function listAppConversations(
  userId: string,
  serverSecret: string,
  filters: AppConversationListFilters = {},
): Promise<AppConversationSummary[]> {
  if (filters.projectId) {
    return (
      (await convex.query<AppConversationSummary[]>(
        "conversations:listByProject",
        {
          projectId: filters.projectId,
          userId,
          serverSecret,
          ...(filters.updatedSince !== undefined
            ? { updatedSince: filters.updatedSince }
            : {}),
          ...(filters.includeDeleted !== undefined
            ? { includeDeleted: filters.includeDeleted }
            : {}),
        },
      )) || []
    );
  }

  return (
    (await convex.query<AppConversationSummary[]>("conversations:list", {
      userId,
      serverSecret,
      ...(filters.updatedSince !== undefined
        ? { updatedSince: filters.updatedSince }
        : {}),
      ...(filters.includeDeleted !== undefined
        ? { includeDeleted: filters.includeDeleted }
        : {}),
    })) || []
  );
}

export async function getAppConversation(
  userId: string,
  serverSecret: string,
  conversationId: string,
): Promise<AppConversationSummary | null> {
  return await convex.query<AppConversationSummary | null>(
    "conversations:get",
    {
      conversationId: conversationId as Id<"conversations">,
      userId,
      serverSecret,
    },
  );
}

export async function listAppConversationMessages(
  userId: string,
  serverSecret: string,
  conversationId: string,
): Promise<AppConversationMessage[]> {
  const messages =
    (await convex.query<
      Array<{
        _id: string;
        turnId: string;
        role: "user" | "assistant";
        mode: "ask" | "act";
        content: string;
        contentType: "text" | "image" | "video";
        parts?: Array<
          | {
              type: string;
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
            }
        >;
        modelId?: string;
        variantIndex?: number;
        replyToTurnId?: string;
        replySnippet?: string;
        routedModelId?: string;
      }>
    >("conversations:getMessages", {
      conversationId: conversationId as Id<"conversations">,
      userId,
      serverSecret,
    })) || [];

  return messages.map(toApiConversationMessage);
}

export async function createAppConversation(
  input: AppCreateConversationInput,
): Promise<AppCreateConversationResult> {
  const entitlements = await convex.query<{
    tier: "free" | "pro" | "max";
  } | null>(
    "usage:getEntitlementsByServer",
    {
      userId: input.userId,
      serverSecret: input.serverSecret,
    },
    { throwOnError: true },
  );

  const isFreeTier = entitlements?.tier === "free";
  const id = await convex.mutation<Id<"conversations">>(
    "conversations:create",
    {
      userId: input.userId,
      serverSecret: input.serverSecret,
      clientId: input.clientId?.trim() || undefined,
      title: input.title || "New Chat",
      projectId: input.projectId ?? undefined,
      askModelIds: isFreeTier ? [FREE_TIER_AUTO_MODEL_ID] : input.askModelIds,
      actModelId: isFreeTier
        ? FREE_TIER_AUTO_MODEL_ID
        : (input.actModelId ?? input.askModelIds?.[0] ?? DEFAULT_MODEL_ID),
      lastMode: input.lastMode,
    },
  );
  if (!id) {
    throw new Error("Failed to create conversation");
  }

  return {
    id,
    conversation: await getAppConversation(
      input.userId,
      input.serverSecret,
      id,
    ),
  };
}

export async function updateAppConversation(
  input: AppUpdateConversationInput,
): Promise<AppUpdateConversationResult> {
  await convex.mutation("conversations:update", {
    conversationId: input.conversationId as Id<"conversations">,
    userId: input.userId,
    serverSecret: input.serverSecret,
    title: input.title,
    projectId: input.projectId,
    askModelIds: input.askModelIds,
    actModelId: input.actModelId,
    lastMode: input.lastMode,
  });

  return {
    success: true,
    conversation: await getAppConversation(
      input.userId,
      input.serverSecret,
      input.conversationId,
    ),
  };
}

export async function deleteAppConversation(
  userId: string,
  serverSecret: string,
  conversationId: string,
): Promise<AppDeleteConversationResult> {
  await convex.mutation("conversations:remove", {
    conversationId: conversationId as Id<"conversations">,
    userId,
    serverSecret,
  });

  return {
    success: true,
    conversationId,
    deletedAt: Date.now(),
  };
}

export async function persistAppConversationMessage(
  input: AppPersistConversationMessageInput,
): Promise<AppPersistConversationMessageResult> {
  const normalizedParts = sanitizeMessagePartsForPersistence(input.parts, {
    attachmentNames: input.attachmentNames,
  });
  const normalizedContent = buildPersistedMessageContent(
    input.content,
    input.parts,
    {
      attachmentNames: input.attachmentNames,
    },
  );

  const turnId = input.turnId.trim();
  if (!normalizedContent || !turnId) {
    throw new Error(
      "conversationId, turnId, role, and content or attachment are required",
    );
  }

  await convex.mutation(
    "conversations:addMessage",
    {
      conversationId: input.conversationId as Id<"conversations">,
      userId: input.userId,
      serverSecret: input.serverSecret,
      turnId,
      role: input.role,
      mode: input.mode ?? "ask",
      content: normalizedContent,
      contentType: input.contentType ?? "text",
      parts: normalizedParts,
      modelId: input.modelId ?? input.model,
      variantIndex: input.variantIndex,
      ...(input.replyToTurnId?.trim()
        ? {
            replyToTurnId: input.replyToTurnId.trim(),
            replySnippet: input.replySnippet?.trim(),
          }
        : {}),
    },
    { throwOnError: true },
  );

  return {
    success: true,
    conversationId: input.conversationId,
    turnId,
  };
}

export async function deleteAppConversationMessage(
  input: AppDeleteConversationMessageInput,
): Promise<AppPersistConversationMessageResult> {
  await convex.mutation(
    "conversations:deleteTurn",
    {
      conversationId: input.conversationId as Id<"conversations">,
      userId: input.userId,
      serverSecret: input.serverSecret,
      turnId: input.turnId,
    },
    { throwOnError: true },
  );

  return {
    success: true,
    conversationId: input.conversationId,
    turnId: input.turnId,
  };
}
