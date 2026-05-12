import type { ConvexRawClient, IDatabase } from './interface'
import type {
  AppSettings,
  DatabaseAuditEvent,
  AutomationRecord,
  Conversation,
  ConversationMessage,
  FileRecord,
  ListOptions,
  McpServerRecord,
  Memory,
  NewConversation,
  NewConversationMessage,
  NewFileRecord,
  NewMemory,
  NewNote,
  NewOrganization,
  NewOutputRecord,
  NewProject,
  NewUser,
  Note,
  Organization,
  OutputRecord,
  Project,
  SkillRecord,
  UsageEntitlements,
  User,
} from './types'

export interface ConvexDatabaseOptions {
  client: ConvexRawClient
  providerId?: string
}

export class ConvexDatabase implements IDatabase {
  readonly providerId: string
  readonly raw: ConvexRawClient

  constructor(options: ConvexDatabaseOptions) {
    this.providerId = options.providerId ?? 'convex'
    this.raw = options.client
  }

  async health(): Promise<{ ok: boolean; message?: string; latencyMs?: number }> {
    const start = Date.now()
    const result = await this.raw.query('health:ping', {}, { suppressNetworkConsoleError: true })
    return {
      ok: result != null,
      message: result == null ? 'Convex health ping returned no value' : undefined,
      latencyMs: Date.now() - start,
    }
  }

  async init(): Promise<void> {}
  async shutdown(): Promise<void> {}

  createOrganization(data: NewOrganization): Promise<Organization> {
    return this.raw.mutation<Organization>('organizations:create', toArgs(data)).then(requireValue)
  }
  getOrganization(id: string): Promise<Organization | null> {
    return this.raw.query<Organization>('organizations:get', { id })
  }
  listOrganizations(opts?: ListOptions): Promise<Organization[]> {
    return this.raw.query<Organization[]>('organizations:list', toArgs(opts ?? {})).then(defaultArray)
  }

  createConversation(data: NewConversation): Promise<Conversation> {
    return this.raw.mutation<Conversation>('conversations:create', toArgs(data)).then(requireValue)
  }
  getConversation(id: string): Promise<Conversation | null> {
    return this.raw.query<Conversation>('conversations:get', { id })
  }
  updateConversation(id: string, patch: Partial<Conversation>): Promise<Conversation> {
    return this.raw.mutation<Conversation>('conversations:update', { id, ...patch }).then(requireValue)
  }
  async deleteConversation(id: string): Promise<void> {
    await this.raw.mutation('conversations:remove', { id })
  }
  listConversations(userId: string, opts?: ListOptions): Promise<Conversation[]> {
    return this.raw.query<Conversation[]>('conversations:list', { userId, ...(toArgs(opts ?? {})) }).then(defaultArray)
  }

  createMessage(data: NewConversationMessage): Promise<ConversationMessage> {
    return this.raw.mutation<ConversationMessage>('conversations:addMessage', toArgs(data)).then(requireValue)
  }
  getMessage(id: string): Promise<ConversationMessage | null> {
    return this.raw.query<ConversationMessage>('conversations:getMessage', { id })
  }
  updateMessage(id: string, patch: Partial<ConversationMessage>): Promise<ConversationMessage> {
    return this.raw.mutation<ConversationMessage>('conversations:updateMessage', { id, ...patch }).then(requireValue)
  }
  async deleteMessage(id: string): Promise<void> {
    await this.raw.mutation('conversations:deleteTurn', { messageId: id })
  }
  listMessages(conversationId: string, opts?: ListOptions): Promise<ConversationMessage[]> {
    return this.raw.query<ConversationMessage[]>('conversations:listMessages', { conversationId, ...(toArgs(opts ?? {})) }).then(defaultArray)
  }
  appendMessageDelta(id: string, delta: string): Promise<ConversationMessage> {
    return this.raw
      .mutation<ConversationMessage>('conversations:appendGeneratingMessageDelta', { messageId: id, delta })
      .then(requireValue)
  }
  finalizeMessage(id: string, patch?: Partial<ConversationMessage>): Promise<ConversationMessage> {
    return this.raw
      .mutation<ConversationMessage>('conversations:finalizeGeneratingMessage', { messageId: id, ...(patch ?? {}) })
      .then(requireValue)
  }
  failMessage(id: string, reason: string): Promise<ConversationMessage> {
    return this.raw
      .mutation<ConversationMessage>('conversations:failGeneratingMessage', { messageId: id, error: reason })
      .then(requireValue)
  }

  getUser(id: string): Promise<User | null> {
    return this.raw.query<User>('users:getById', { userId: id })
  }
  getUserByEmail(email: string): Promise<User | null> {
    return this.raw.query<User>('users:getByEmail', { email })
  }
  createUser(data: NewUser): Promise<User> {
    return this.raw.mutation<User>('users:create', toArgs(data)).then(requireValue)
  }
  updateUser(id: string, patch: Partial<User>): Promise<User> {
    return this.raw.mutation<User>('users:update', { id, ...patch }).then(requireValue)
  }
  async deleteUser(id: string): Promise<void> {
    await this.raw.mutation('users:delete', { id })
  }
  listUsers(opts?: ListOptions): Promise<User[]> {
    return this.raw.query<User[]>('users:listAllUsersForAdmin', toArgs(opts ?? {})).then(defaultArray)
  }

  createProject(data: NewProject): Promise<Project> {
    return this.raw.mutation<Project>('projects:create', toArgs(data)).then(requireValue)
  }
  getProject(id: string): Promise<Project | null> {
    return this.raw.query<Project>('projects:get', { id })
  }
  updateProject(id: string, patch: Partial<Project>): Promise<Project> {
    return this.raw.mutation<Project>('projects:update', { id, ...patch }).then(requireValue)
  }
  async deleteProject(id: string): Promise<void> {
    await this.raw.mutation('projects:remove', { id })
  }
  listProjects(userId: string, opts?: ListOptions): Promise<Project[]> {
    return this.raw.query<Project[]>('projects:list', { userId, ...(toArgs(opts ?? {})) }).then(defaultArray)
  }

  createMemory(data: NewMemory): Promise<Memory> {
    return this.raw.mutation<Memory>('memories:add', toArgs(data)).then(requireValue)
  }
  getMemory(id: string): Promise<Memory | null> {
    return this.raw.query<Memory[]>('memories:list', { id }).then((rows) => rows?.[0] ?? null)
  }
  updateMemory(id: string, patch: Partial<Memory>): Promise<Memory> {
    return this.raw.mutation<Memory>('memories:update', { id, ...patch }).then(requireValue)
  }
  async deleteMemory(id: string): Promise<void> {
    await this.raw.mutation('memories:remove', { id })
  }
  searchMemories(userId: string, query: string, opts?: ListOptions): Promise<Memory[]> {
    return this.raw.query<Memory[]>('memories:search', { userId, query, ...(toArgs(opts ?? {})) }).then(defaultArray)
  }
  listMemories(userId: string, opts?: ListOptions): Promise<Memory[]> {
    return this.raw.query<Memory[]>('memories:list', { userId, ...(toArgs(opts ?? {})) }).then(defaultArray)
  }

  createFileRecord(data: NewFileRecord): Promise<FileRecord> {
    return this.raw.mutation<FileRecord>('files:create', toArgs(data)).then(requireValue)
  }
  getFileRecord(id: string): Promise<FileRecord | null> {
    return this.raw.query<FileRecord>('files:get', { id })
  }
  updateFileRecord(id: string, patch: Partial<FileRecord>): Promise<FileRecord> {
    return this.raw.mutation<FileRecord>('files:update', { id, ...patch }).then(requireValue)
  }
  async deleteFileRecord(id: string): Promise<void> {
    await this.raw.mutation('files:remove', { id })
  }
  listFileRecords(userId: string, opts?: ListOptions): Promise<FileRecord[]> {
    return this.raw.query<FileRecord[]>('files:list', { userId, ...(toArgs(opts ?? {})) }).then(defaultArray)
  }

  createNote(data: NewNote): Promise<Note> {
    return this.raw.mutation<Note>('files:create', { ...data, type: 'file' }).then(requireValue)
  }
  getNote(id: string): Promise<Note | null> {
    return this.raw.query<Note>('files:get', { id })
  }
  updateNote(id: string, patch: Partial<Note>): Promise<Note> {
    return this.raw.mutation<Note>('files:update', { id, ...patch }).then(requireValue)
  }
  async deleteNote(id: string): Promise<void> {
    await this.raw.mutation('files:remove', { id })
  }
  listNotes(userId: string, opts?: ListOptions): Promise<Note[]> {
    return this.raw.query<Note[]>('files:list', { userId, kind: 'note', ...(toArgs(opts ?? {})) }).then(defaultArray)
  }

  createOutput(data: NewOutputRecord): Promise<OutputRecord> {
    return this.raw.mutation<OutputRecord>('outputs:create', toArgs(data)).then(requireValue)
  }
  getOutput(id: string): Promise<OutputRecord | null> {
    return this.raw.query<OutputRecord>('outputs:get', { id })
  }
  updateOutput(id: string, patch: Partial<OutputRecord>): Promise<OutputRecord> {
    return this.raw.mutation<OutputRecord>('outputs:update', { id, ...patch }).then(requireValue)
  }
  listOutputs(userId: string, opts?: ListOptions): Promise<OutputRecord[]> {
    return this.raw.query<OutputRecord[]>('outputs:list', { userId, ...(toArgs(opts ?? {})) }).then(defaultArray)
  }

  listSkills(userId: string, opts?: ListOptions): Promise<SkillRecord[]> {
    return this.raw.query<SkillRecord[]>('skills:list', { userId, ...(toArgs(opts ?? {})) }).then(defaultArray)
  }
  listMcpServers(userId: string, opts?: ListOptions): Promise<McpServerRecord[]> {
    return this.raw.query<McpServerRecord[]>('mcpServers:list', { userId, ...(toArgs(opts ?? {})) }).then(defaultArray)
  }
  getEntitlements(userId: string): Promise<UsageEntitlements | null> {
    return this.raw.query<UsageEntitlements>('usage:getEntitlementsByServer', { userId })
  }
  async recordUsage(userId: string, events: Array<Record<string, unknown>>): Promise<void> {
    await this.raw.mutation('usage:recordBatch', { userId, events })
  }
  getSettings(userId: string): Promise<AppSettings | null> {
    return this.raw.query<AppSettings>('uiSettings:getByServer', { userId })
  }
  updateSettings(userId: string, settings: Record<string, unknown>): Promise<AppSettings> {
    return this.raw.mutation<AppSettings>('uiSettings:updateByServer', { userId, settings }).then(requireValue)
  }
  getOnboardingStatus(userId: string): Promise<{ hasSeenOnboarding: boolean }> {
    return this.raw.query<{ hasSeenOnboarding: boolean }>('users:getOnboardingStatus', { userId }).then((value) => value ?? { hasSeenOnboarding: false })
  }
  async markOnboardingComplete(userId: string): Promise<void> {
    await this.raw.mutation('users:markOnboardingComplete', { userId })
  }
  async resetOnboarding(userId: string): Promise<void> {
    await this.raw.mutation('users:resetOnboarding', { userId })
  }
  listAutomations(userId: string, opts?: ListOptions): Promise<AutomationRecord[]> {
    return this.raw.query<AutomationRecord[]>('automations:list', { userId, ...(toArgs(opts ?? {})) }).then(defaultArray)
  }
  recordDatabaseAuditEvent(event: Omit<DatabaseAuditEvent, 'id' | 'createdAt'>): Promise<DatabaseAuditEvent> {
    return this.raw.mutation<DatabaseAuditEvent>('audit:record', toArgs(event)).then(requireValue)
  }
  listDatabaseAuditEvents(orgId: string, opts?: ListOptions): Promise<DatabaseAuditEvent[]> {
    return this.raw.query<DatabaseAuditEvent[]>('audit:list', { orgId, ...(toArgs(opts ?? {})) }).then(defaultArray)
  }
}

function requireValue<T>(value: T | null): T {
  if (value == null) throw new Error('Convex provider returned no value.')
  return value
}

function defaultArray<T>(value: T[] | null): T[] {
  return Array.isArray(value) ? value : []
}

function toArgs(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? { ...(value as Record<string, unknown>) } : {}
}
