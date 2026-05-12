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
  Organization,
  NewOrganization,
  Project,
  NewProject,
  ConversationMessage,
  NewConversationMessage,
  OutputRecord,
  NewOutputRecord,
  SkillRecord,
  McpServerRecord,
  UsageEntitlements,
  AppSettings,
  AutomationRecord,
  DatabaseAuditEvent,
  ListOptions,
} from './types'

export interface ConvexRawClient {
  query<T>(path: string, args: Record<string, unknown>, options?: unknown): Promise<T | null>
  mutation<T>(path: string, args: Record<string, unknown>, options?: unknown): Promise<T | null>
  action<T>(path: string, args: Record<string, unknown>, options?: unknown): Promise<T | null>
}

export interface IDatabase {
  readonly providerId?: string
  raw?: ConvexRawClient

  health(): Promise<{ ok: boolean; message?: string; latencyMs?: number }>

  // Organizations
  createOrganization(data: NewOrganization): Promise<Organization>
  getOrganization(id: string): Promise<Organization | null>
  listOrganizations(opts?: ListOptions): Promise<Organization[]>

  // Conversations
  createConversation(data: NewConversation): Promise<Conversation>
  getConversation(id: string): Promise<Conversation | null>
  updateConversation(id: string, patch: Partial<Conversation>): Promise<Conversation>
  deleteConversation(id: string): Promise<void>
  listConversations(userId: string, opts?: ListOptions): Promise<Conversation[]>

  // Conversation messages
  createMessage(data: NewConversationMessage): Promise<ConversationMessage>
  getMessage(id: string): Promise<ConversationMessage | null>
  updateMessage(id: string, patch: Partial<ConversationMessage>): Promise<ConversationMessage>
  deleteMessage(id: string): Promise<void>
  listMessages(conversationId: string, opts?: ListOptions): Promise<ConversationMessage[]>
  appendMessageDelta(id: string, delta: string): Promise<ConversationMessage>
  finalizeMessage(id: string, patch?: Partial<ConversationMessage>): Promise<ConversationMessage>
  failMessage(id: string, reason: string): Promise<ConversationMessage>

  // Users
  getUser(id: string): Promise<User | null>
  getUserByEmail(email: string): Promise<User | null>
  createUser(data: NewUser): Promise<User>
  updateUser(id: string, patch: Partial<User>): Promise<User>
  deleteUser(id: string): Promise<void>
  listUsers(opts?: ListOptions): Promise<User[]>

  // Projects
  createProject(data: NewProject): Promise<Project>
  getProject(id: string): Promise<Project | null>
  updateProject(id: string, patch: Partial<Project>): Promise<Project>
  deleteProject(id: string): Promise<void>
  listProjects(userId: string, opts?: ListOptions): Promise<Project[]>

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

  // Outputs
  createOutput(data: NewOutputRecord): Promise<OutputRecord>
  getOutput(id: string): Promise<OutputRecord | null>
  updateOutput(id: string, patch: Partial<OutputRecord>): Promise<OutputRecord>
  listOutputs(userId: string, opts?: ListOptions): Promise<OutputRecord[]>

  // Skills / MCP servers
  listSkills(userId: string, opts?: ListOptions): Promise<SkillRecord[]>
  listMcpServers(userId: string, opts?: ListOptions): Promise<McpServerRecord[]>

  // Usage / settings / onboarding
  getEntitlements(userId: string): Promise<UsageEntitlements | null>
  recordUsage(userId: string, events: Array<Record<string, unknown>>): Promise<void>
  getSettings(userId: string): Promise<AppSettings | null>
  updateSettings(userId: string, settings: Record<string, unknown>): Promise<AppSettings>
  getOnboardingStatus(userId: string): Promise<{ hasSeenOnboarding: boolean }>
  markOnboardingComplete(userId: string): Promise<void>
  resetOnboarding(userId: string): Promise<void>

  // Automations / audit
  listAutomations(userId: string, opts?: ListOptions): Promise<AutomationRecord[]>
  recordDatabaseAuditEvent(event: Omit<DatabaseAuditEvent, 'id' | 'createdAt'>): Promise<DatabaseAuditEvent>
  listDatabaseAuditEvents(orgId: string, opts?: ListOptions): Promise<DatabaseAuditEvent[]>
}
