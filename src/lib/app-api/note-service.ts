import { convex } from "@/lib/convex";
import type {
  AppCreateNoteInput,
  AppCreateNoteResult,
  AppDeleteNoteResult,
  AppNoteDoc,
  AppNoteListFilters,
  AppUpdateNoteInput,
  AppUpdateNoteResult,
} from "@/lib/app-api/note-contract";

export async function listAppNotes(
  userId: string,
  serverSecret: string,
  filters: AppNoteListFilters = {},
): Promise<AppNoteDoc[]> {
  if (filters.projectId !== undefined) {
    return (
      (await convex.query<AppNoteDoc[]>("notes:listByProject", {
        projectId: filters.projectId,
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

  return (
    (await convex.query<AppNoteDoc[]>("notes:list", {
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

export async function getAppNote(
  userId: string,
  serverSecret: string,
  noteId: string,
): Promise<AppNoteDoc | null> {
  return await convex.query<AppNoteDoc | null>("notes:get", {
    noteId,
    userId,
    serverSecret,
  });
}

export async function createAppNote(
  input: AppCreateNoteInput,
): Promise<AppCreateNoteResult> {
  const noteId = await convex.mutation<string>("notes:create", {
    userId: input.userId,
    serverSecret: input.serverSecret,
    clientId: input.clientId?.trim() || undefined,
    title: input.title || "Untitled",
    content: input.content || "",
    tags: input.tags || [],
    projectId: input.projectId ?? undefined,
  });
  if (!noteId) {
    throw new Error("Failed to create note");
  }

  return {
    id: noteId,
    note: await getAppNote(input.userId, input.serverSecret, noteId),
  };
}

export async function updateAppNote(
  input: AppUpdateNoteInput,
): Promise<AppUpdateNoteResult> {
  await convex.mutation("notes:update", {
    userId: input.userId,
    serverSecret: input.serverSecret,
    noteId: input.noteId,
    title: input.title,
    content: input.content,
    tags: input.tags,
    projectId: input.projectId,
  });

  return {
    success: true,
    note: await getAppNote(input.userId, input.serverSecret, input.noteId),
  };
}

export async function deleteAppNote(
  userId: string,
  serverSecret: string,
  noteId: string,
): Promise<AppDeleteNoteResult> {
  await convex.mutation("notes:remove", {
    noteId,
    userId,
    serverSecret,
  });

  return {
    success: true,
    noteId,
    deletedAt: Date.now(),
  };
}
