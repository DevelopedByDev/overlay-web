// @enterprise-future — not wired to production
// STATUS: Not wired to production. Safe to modify.
// WIRE TARGET: convex/ (when Phase 7 is approved)
// RISK LEVEL: Low (no production imports)

import type {
  Conversation,
  NewConversation,
  User,
  NewUser,
  Memory,
  NewMemory,
  FileRecord,
  NewFileRecord,
  Note,
  NewNote,
  ListOptions,
} from './types'

export interface IDatabase {
  // Conversations
  createConversation(data: NewConversation): Promise<Conversation>
  getConversation(id: string): Promise<Conversation | null>
  updateConversation(id: string, patch: Partial<Conversation>): Promise<Conversation>
  deleteConversation(id: string): Promise<void>
  listConversations(userId: string, opts?: ListOptions): Promise<Conversation[]>

  // Users
  getUser(id: string): Promise<User | null>
  getUserByEmail(email: string): Promise<User | null>
  createUser(data: NewUser): Promise<User>
  updateUser(id: string, patch: Partial<User>): Promise<User>
  deleteUser(id: string): Promise<void>
  listUsers(opts?: ListOptions): Promise<User[]>

  // Memories
  createMemory(data: NewMemory): Promise<Memory>
  getMemory(id: string): Promise<Memory | null>
  updateMemory(id: string, patch: Partial<Memory>): Promise<Memory>
  deleteMemory(id: string): Promise<void>
  searchMemories(userId: string, query: string, opts?: ListOptions): Promise<Memory[]>
  listMemories(userId: string, opts?: ListOptions): Promise<Memory[]>

  // Files / Knowledge
  createFileRecord(data: NewFileRecord): Promise<FileRecord>
  getFileRecord(id: string): Promise<FileRecord | null>
  updateFileRecord(id: string, patch: Partial<FileRecord>): Promise<FileRecord>
  deleteFileRecord(id: string): Promise<void>
  listFileRecords(userId: string, opts?: ListOptions): Promise<FileRecord[]>

  // Notes
  createNote(data: NewNote): Promise<Note>
  getNote(id: string): Promise<Note | null>
  updateNote(id: string, patch: Partial<Note>): Promise<Note>
  deleteNote(id: string): Promise<void>
  listNotes(userId: string, opts?: ListOptions): Promise<Note[]>
}
