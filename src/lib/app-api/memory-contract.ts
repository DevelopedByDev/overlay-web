import type { StoredMemory } from "@/lib/app-store";

export type AppMemorySource = "chat" | "note" | "manual";
export type AppMemoryType =
  | "preference"
  | "fact"
  | "project"
  | "decision"
  | "agent";
export type AppMemoryActor = "user" | "agent";
export type AppMemoryStatus = "candidate" | "approved" | "rejected";

export interface AppMemoryDoc {
  _id: string;
  userId: string;
  clientId?: string;
  content: string;
  source: AppMemorySource;
  type?: AppMemoryType;
  importance?: number;
  projectId?: string;
  conversationId?: string;
  noteId?: string;
  messageId?: string;
  turnId?: string;
  tags?: string[];
  actor?: AppMemoryActor;
  status?: AppMemoryStatus;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
}

export interface AppMemoryListRow {
  key: string;
  memoryId: string;
  segmentIndex: number;
  content: string;
  fullContent: string;
  source: AppMemorySource;
  type?: AppMemoryType;
  importance?: number;
  projectId?: string;
  conversationId?: string;
  noteId?: string;
  messageId?: string;
  turnId?: string;
  tags?: string[];
  actor?: AppMemoryActor;
  status?: AppMemoryStatus;
  createdAt: number;
  updatedAt?: number;
}

export interface AppMemoryListFilters {
  updatedSince?: number;
  includeDeleted?: boolean;
  projectId?: string;
  conversationId?: string;
  noteId?: string;
}

export interface AppCreateMemoryInput {
  userId: string;
  serverSecret: string;
  clientId?: string;
  content: string;
  source?: string;
  type?: AppMemoryType;
  importance?: number;
  projectId?: string;
  conversationId?: string;
  noteId?: string;
  messageId?: string;
  turnId?: string;
  tags?: string[];
  actor?: AppMemoryActor;
  status?: AppMemoryStatus;
}

export interface AppUpdateMemoryInput {
  userId: string;
  serverSecret: string;
  memoryId: string;
  content: string;
  source?: AppMemorySource;
  type?: AppMemoryType;
  importance?: number;
  projectId?: string;
  conversationId?: string;
  noteId?: string;
  messageId?: string;
  turnId?: string;
  tags?: string[];
  actor?: AppMemoryActor;
  status?: AppMemoryStatus;
}

export interface AppDeleteMemoryInput {
  userId: string;
  serverSecret: string;
  memoryId: string;
}

export interface AppCreateMemoryResult {
  id: string;
  ids: string[];
  count: number;
  memory?: AppMemoryDoc;
}

export interface AppUpdateMemoryResult {
  success: true;
  memory?: AppMemoryDoc;
}

export interface AppDeleteMemoryResult {
  success: true;
  memoryId: string;
  deletedAt: number;
}

export function readOptionalBooleanParam(
  value: string | null,
): boolean | undefined {
  if (value == null) return undefined;
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  return undefined;
}

export function coerceAppMemorySource(
  value: string | undefined,
): AppMemorySource {
  if (value === "chat" || value === "note" || value === "manual") {
    return value;
  }
  return "manual";
}

export function toFallbackAppMemoryDoc(
  userId: string,
  memory: StoredMemory,
): AppMemoryDoc {
  return {
    _id: memory._id,
    userId,
    content: memory.content,
    source: memory.source,
    createdAt: memory.createdAt,
    updatedAt: memory.createdAt,
  };
}
