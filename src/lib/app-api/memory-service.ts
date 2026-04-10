import { convex } from "@/lib/convex";
import { addMemory, listMemories, removeMemory } from "@/lib/app-store";
import {
  memoriesToClientListRows,
  segmentMemoryForIngestion,
} from "@/lib/memory-display-segments";
import type {
  AppCreateMemoryInput,
  AppCreateMemoryResult,
  AppDeleteMemoryInput,
  AppDeleteMemoryResult,
  AppMemoryDoc,
  AppMemoryListFilters,
  AppMemoryListRow,
  AppUpdateMemoryInput,
  AppUpdateMemoryResult,
} from "@/lib/app-api/memory-contract";
import {
  coerceAppMemorySource,
  toFallbackAppMemoryDoc,
} from "@/lib/app-api/memory-contract";
import type { Id } from "../../../convex/_generated/dataModel";

async function queryMemoryDocs(
  userId: string,
  serverSecret: string,
  filters: AppMemoryListFilters = {},
): Promise<AppMemoryDoc[]> {
  const fromConvex = await convex.query<AppMemoryDoc[]>("memories:list", {
    userId,
    serverSecret,
    ...(filters.updatedSince !== undefined
      ? { updatedSince: filters.updatedSince }
      : {}),
    ...(filters.includeDeleted !== undefined
      ? { includeDeleted: filters.includeDeleted }
      : {}),
    ...(filters.projectId ? { projectId: filters.projectId } : {}),
    ...(filters.conversationId
      ? { conversationId: filters.conversationId }
      : {}),
    ...(filters.noteId ? { noteId: filters.noteId } : {}),
  });

  if (Array.isArray(fromConvex)) {
    return fromConvex;
  }

  return listMemories(userId).map((memory) =>
    toFallbackAppMemoryDoc(userId, memory),
  );
}

export async function listAppMemoryDocs(
  userId: string,
  serverSecret: string,
  filters: AppMemoryListFilters = {},
): Promise<AppMemoryDoc[]> {
  return queryMemoryDocs(userId, serverSecret, filters);
}

export async function listAppMemoryRows(
  userId: string,
  serverSecret: string,
  filters: AppMemoryListFilters = {},
): Promise<AppMemoryListRow[]> {
  const docs = await queryMemoryDocs(userId, serverSecret, filters);
  return memoriesToClientListRows(docs);
}

export async function getAppMemory(
  userId: string,
  serverSecret: string,
  memoryId: string,
): Promise<AppMemoryDoc | null> {
  const memories = await queryMemoryDocs(userId, serverSecret, {
    includeDeleted: true,
  });
  return memories.find((item) => item._id === memoryId) ?? null;
}

export async function createAppMemories(
  input: AppCreateMemoryInput,
): Promise<AppCreateMemoryResult> {
  const trimmed = input.content.trim();
  const source = coerceAppMemorySource(input.source);
  const chunks = segmentMemoryForIngestion(trimmed);
  const clientIdSingle =
    chunks.length === 1 ? input.clientId?.trim() || undefined : undefined;

  const ids: string[] = [];
  for (const chunk of chunks) {
    const memoryId = await convex.mutation<string>("memories:add", {
      userId: input.userId,
      serverSecret: input.serverSecret,
      clientId: clientIdSingle,
      content: chunk,
      source,
      type: input.type,
      importance: input.importance,
      projectId: input.projectId ?? undefined,
      conversationId: input.conversationId ?? undefined,
      noteId: input.noteId ?? undefined,
      messageId: input.messageId ?? undefined,
      turnId: input.turnId ?? undefined,
      tags: input.tags,
      actor: input.actor,
      status: input.status,
    });
    const id = memoryId || addMemory(input.userId, chunk, source);
    ids.push(id);
  }

  const firstId = ids[0] ?? "";
  return {
    id: firstId,
    ids,
    count: ids.length,
    memory: firstId
      ? ((await getAppMemory(input.userId, input.serverSecret, firstId)) ??
        undefined)
      : undefined,
  };
}

export async function updateAppMemory(
  input: AppUpdateMemoryInput,
): Promise<AppUpdateMemoryResult> {
  await convex.mutation("memories:update", {
    userId: input.userId,
    serverSecret: input.serverSecret,
    memoryId: input.memoryId as Id<"memories">,
    content: input.content,
    source: input.source,
    type: input.type,
    importance: input.importance,
    projectId: input.projectId,
    conversationId: input.conversationId,
    noteId: input.noteId,
    messageId: input.messageId,
    turnId: input.turnId,
    tags: input.tags,
    actor: input.actor,
    status: input.status,
  });

  return {
    success: true,
    memory:
      (await getAppMemory(input.userId, input.serverSecret, input.memoryId)) ??
      undefined,
  };
}

export async function deleteAppMemory(
  input: AppDeleteMemoryInput,
): Promise<AppDeleteMemoryResult> {
  await convex.mutation("memories:remove", {
    memoryId: input.memoryId as Id<"memories">,
    userId: input.userId,
    serverSecret: input.serverSecret,
  });
  removeMemory(input.memoryId);
  return {
    success: true,
    memoryId: input.memoryId,
    deletedAt: Date.now(),
  };
}
