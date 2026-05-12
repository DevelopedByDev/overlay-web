import type { IDatabase } from './interface'
import { POSTGRES_MIGRATIONS } from './postgres-schema'
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
import { newId, nowMs, withDefaultOrg } from './utils'

type PgPool = {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>
  end(): Promise<void>
}

type PgModule = {
  Pool: new (options: Record<string, unknown>) => PgPool
}

export interface PostgresDatabaseOptions {
  url: string
  pool?: {
    max?: number
    idleTimeoutMillis?: number
  }
  migrationsTable?: string
  migrationMode?: 'manual' | 'startup'
  defaultOrgId?: string
}

export class PostgresDatabase implements IDatabase {
  readonly providerId = 'postgres'
  private pool: PgPool | null = null
  private readonly defaultOrgId: string

  constructor(private readonly options: PostgresDatabaseOptions) {
    this.defaultOrgId = options.defaultOrgId ?? 'default'
  }

  async init(): Promise<void> {
    await this.getPool()
    if (this.options.migrationMode === 'startup') {
      await this.migrate()
    }
    await this.ensureDefaultOrg()
  }

  async shutdown(): Promise<void> {
    await this.pool?.end()
    this.pool = null
  }

  async health(): Promise<{ ok: boolean; message?: string; latencyMs?: number }> {
    const start = Date.now()
    await this.query('SELECT 1')
    return { ok: true, latencyMs: Date.now() - start }
  }

  async migrate(): Promise<void> {
    const migrationsTable = this.options.migrationsTable ?? '__overlay_migrations'
    await this.query(`CREATE TABLE IF NOT EXISTS ${quoteIdent(migrationsTable)} (id TEXT PRIMARY KEY, applied_at BIGINT NOT NULL)`)
    for (const migration of POSTGRES_MIGRATIONS) {
      const existing = await this.query<{ id: string }>(`SELECT id FROM ${quoteIdent(migrationsTable)} WHERE id = $1`, [migration.id])
      if (existing.length) continue
      await this.query(migration.sql)
      await this.query(`INSERT INTO ${quoteIdent(migrationsTable)} (id, applied_at) VALUES ($1, $2)`, [migration.id, nowMs()])
    }
  }

  async createOrganization(data: NewOrganization): Promise<Organization> {
    const now = nowMs()
    const org = { id: data.id ?? newId('org'), name: data.name, slug: data.slug, createdAt: now, updatedAt: now }
    await this.query(
      'INSERT INTO overlay_orgs (id, name, slug, created_at, updated_at) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, slug = EXCLUDED.slug, updated_at = EXCLUDED.updated_at',
      [org.id, org.name, org.slug ?? null, org.createdAt, org.updatedAt],
    )
    return org
  }

  async getOrganization(id: string): Promise<Organization | null> {
    const rows = await this.query('SELECT * FROM overlay_orgs WHERE id = $1', [id])
    return rows[0] ? mapOrg(rows[0]) : null
  }

  async listOrganizations(opts?: ListOptions): Promise<Organization[]> {
    const rows = await this.query(`SELECT * FROM overlay_orgs ORDER BY created_at DESC LIMIT $1`, [opts?.limit ?? 100])
    return rows.map(mapOrg)
  }

  async createConversation(data: NewConversation): Promise<Conversation> {
    const now = nowMs()
    const next = withDefaultOrg(data, this.defaultOrgId)
    const conversation: Conversation = {
      id: newId('conv'),
      orgId: next.orgId,
      title: next.title,
      userId: next.userId,
      projectId: next.projectId,
      lastMode: next.lastMode,
      askModelIds: next.askModelIds,
      actModelId: next.actModelId,
      lastModified: now,
      createdAt: now,
      updatedAt: now,
    }
    await this.query(
      `INSERT INTO overlay_conversations (id, org_id, user_id, project_id, title, last_mode, ask_model_ids, act_model_id, last_modified, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [conversation.id, conversation.orgId, conversation.userId, conversation.projectId ?? null, conversation.title, conversation.lastMode, JSON.stringify(conversation.askModelIds), conversation.actModelId, now, now, now],
    )
    return conversation
  }

  async getConversation(id: string): Promise<Conversation | null> {
    const rows = await this.query('SELECT * FROM overlay_conversations WHERE id = $1 AND deleted_at IS NULL', [id])
    return rows[0] ? mapConversation(rows[0]) : null
  }

  async updateConversation(id: string, patch: Partial<Conversation>): Promise<Conversation> {
    const existing = await this.getConversation(id)
    if (!existing) throw new Error(`Conversation not found: ${id}`)
    const next = { ...existing, ...patch, updatedAt: nowMs(), lastModified: patch.lastModified ?? nowMs() }
    await this.query(
      `UPDATE overlay_conversations SET title=$2, project_id=$3, last_mode=$4, ask_model_ids=$5, act_model_id=$6, last_modified=$7, updated_at=$8, deleted_at=$9 WHERE id=$1`,
      [id, next.title, next.projectId ?? null, next.lastMode, JSON.stringify(next.askModelIds), next.actModelId, next.lastModified, next.updatedAt, next.deletedAt ?? null],
    )
    return next
  }

  async deleteConversation(id: string): Promise<void> {
    await this.query('UPDATE overlay_conversations SET deleted_at=$2, updated_at=$2 WHERE id=$1', [id, nowMs()])
  }

  async listConversations(userId: string, opts?: ListOptions): Promise<Conversation[]> {
    const rows = await this.query(
      'SELECT * FROM overlay_conversations WHERE user_id=$1 AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT $2',
      [userId, opts?.limit ?? 100],
    )
    return rows.map(mapConversation)
  }

  async createMessage(data: NewConversationMessage): Promise<ConversationMessage> {
    const now = nowMs()
    const next = withDefaultOrg(data, this.defaultOrgId)
    const message: ConversationMessage = {
      id: newId('msg'),
      orgId: next.orgId,
      conversationId: next.conversationId,
      userId: next.userId,
      role: next.role,
      content: next.content,
      status: next.status,
      modelId: next.modelId,
      metadata: next.metadata ?? {},
      createdAt: now,
      updatedAt: now,
    }
    await this.query(
      `INSERT INTO overlay_conversation_messages (id, org_id, conversation_id, user_id, role, content, status, model_id, metadata, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [message.id, message.orgId, message.conversationId, message.userId, message.role, message.content, message.status ?? null, message.modelId ?? null, JSON.stringify(message.metadata), now, now],
    )
    return message
  }

  async getMessage(id: string): Promise<ConversationMessage | null> {
    const rows = await this.query('SELECT * FROM overlay_conversation_messages WHERE id=$1', [id])
    return rows[0] ? mapMessage(rows[0]) : null
  }

  async updateMessage(id: string, patch: Partial<ConversationMessage>): Promise<ConversationMessage> {
    const existing = await this.getMessage(id)
    if (!existing) throw new Error(`Message not found: ${id}`)
    const next = { ...existing, ...patch, updatedAt: nowMs() }
    await this.query(
      'UPDATE overlay_conversation_messages SET content=$2, status=$3, model_id=$4, metadata=$5, updated_at=$6 WHERE id=$1',
      [id, next.content, next.status ?? null, next.modelId ?? null, JSON.stringify(next.metadata ?? {}), next.updatedAt],
    )
    return next
  }

  async deleteMessage(id: string): Promise<void> {
    await this.query('DELETE FROM overlay_conversation_messages WHERE id=$1', [id])
  }

  async listMessages(conversationId: string, opts?: ListOptions): Promise<ConversationMessage[]> {
    const rows = await this.query(
      'SELECT * FROM overlay_conversation_messages WHERE conversation_id=$1 ORDER BY created_at ASC LIMIT $2',
      [conversationId, opts?.limit ?? 500],
    )
    return rows.map(mapMessage)
  }

  async appendMessageDelta(id: string, delta: string): Promise<ConversationMessage> {
    const existing = await this.getMessage(id)
    if (!existing) throw new Error(`Message not found: ${id}`)
    return this.updateMessage(id, { content: `${existing.content}${delta}`, status: 'generating' })
  }

  finalizeMessage(id: string, patch?: Partial<ConversationMessage>): Promise<ConversationMessage> {
    return this.updateMessage(id, { ...(patch ?? {}), status: 'completed' })
  }

  failMessage(id: string, reason: string): Promise<ConversationMessage> {
    return this.updateMessage(id, { status: 'failed', metadata: { error: reason } })
  }

  async getUser(id: string): Promise<User | null> {
    const rows = await this.query('SELECT * FROM overlay_users WHERE id=$1', [id])
    return rows[0] ? mapUser(rows[0]) : null
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const rows = await this.query('SELECT * FROM overlay_users WHERE lower(email)=lower($1) LIMIT 1', [email])
    return rows[0] ? mapUser(rows[0]) : null
  }

  async createUser(data: NewUser): Promise<User> {
    const now = nowMs()
    const next = withDefaultOrg(data, this.defaultOrgId)
    const user: User = { id: newId('user'), orgId: next.orgId, email: next.email, firstName: next.firstName, lastName: next.lastName, profilePictureUrl: next.profilePictureUrl, role: next.role ?? 'user', createdAt: now, updatedAt: now }
    await this.query(
      `INSERT INTO overlay_users (id, org_id, email, first_name, last_name, profile_picture_url, role, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [user.id, user.orgId, user.email, user.firstName ?? null, user.lastName ?? null, user.profilePictureUrl ?? null, user.role ?? 'user', now, now],
    )
    return user
  }

  async updateUser(id: string, patch: Partial<User>): Promise<User> {
    const existing = await this.getUser(id)
    if (!existing) throw new Error(`User not found: ${id}`)
    const next = { ...existing, ...patch, updatedAt: nowMs() }
    await this.query(
      'UPDATE overlay_users SET email=$2, first_name=$3, last_name=$4, profile_picture_url=$5, email_verified=$6, role=$7, updated_at=$8 WHERE id=$1',
      [id, next.email, next.firstName ?? null, next.lastName ?? null, next.profilePictureUrl ?? null, next.emailVerified ?? false, next.role ?? 'user', next.updatedAt],
    )
    return next
  }

  async deleteUser(id: string): Promise<void> {
    await this.query('DELETE FROM overlay_users WHERE id=$1', [id])
  }

  async listUsers(opts?: ListOptions): Promise<User[]> {
    const rows = await this.query('SELECT * FROM overlay_users ORDER BY created_at DESC LIMIT $1', [opts?.limit ?? 100])
    return rows.map(mapUser)
  }

  createProject(data: NewProject): Promise<Project> {
    return this.insertJsonBacked<Project, NewProject>('overlay_projects', 'proj', data, mapProject)
  }
  getProject(id: string): Promise<Project | null> {
    return this.selectOne('overlay_projects', id, mapProject)
  }
  updateProject(id: string, patch: Partial<Project>): Promise<Project> {
    return this.updateKnownProject(id, patch)
  }
  async deleteProject(id: string): Promise<void> {
    await this.query('UPDATE overlay_projects SET deleted_at=$2, updated_at=$2 WHERE id=$1', [id, nowMs()])
  }
  async listProjects(userId: string, opts?: ListOptions): Promise<Project[]> {
    const rows = await this.query('SELECT * FROM overlay_projects WHERE user_id=$1 AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT $2', [userId, opts?.limit ?? 100])
    return rows.map(mapProject)
  }

  createMemory(data: NewMemory): Promise<Memory> {
    const now = nowMs()
    const next = withDefaultOrg(data, this.defaultOrgId)
    const memory: Memory = { id: newId('mem'), orgId: next.orgId, key: next.key, segmentIndex: 0, content: next.content, fullContent: next.content, source: 'user', type: next.type, importance: next.importance, projectId: next.projectId, conversationId: next.conversationId, userId: next.userId, createdAt: now, updatedAt: now }
    return this.insertMemory(memory)
  }
  getMemory(id: string): Promise<Memory | null> {
    return this.selectOne('overlay_memories', id, mapMemory)
  }
  updateMemory(id: string, patch: Partial<Memory>): Promise<Memory> {
    return this.genericJsonUpdate('overlay_memories', id, patch, mapMemory)
  }
  async deleteMemory(id: string): Promise<void> {
    await this.query('DELETE FROM overlay_memories WHERE id=$1', [id])
  }
  async searchMemories(userId: string, query: string, opts?: ListOptions): Promise<Memory[]> {
    const rows = await this.query('SELECT * FROM overlay_memories WHERE user_id=$1 AND content ILIKE $2 ORDER BY updated_at DESC NULLS LAST LIMIT $3', [userId, `%${query}%`, opts?.limit ?? 50])
    return rows.map(mapMemory)
  }
  async listMemories(userId: string, opts?: ListOptions): Promise<Memory[]> {
    const rows = await this.query('SELECT * FROM overlay_memories WHERE user_id=$1 ORDER BY updated_at DESC NULLS LAST LIMIT $2', [userId, opts?.limit ?? 100])
    return rows.map(mapMemory)
  }

  createFileRecord(data: NewFileRecord): Promise<FileRecord> {
    const now = nowMs()
    const next = withDefaultOrg(data, this.defaultOrgId)
    const file: FileRecord = { id: newId('file'), orgId: next.orgId, name: next.name, type: next.type, parentId: next.parentId, userId: next.userId, projectId: next.projectId, content: next.content, sizeBytes: next.sizeBytes, storageKey: next.storageKey, isStorageBacked: Boolean(next.storageKey), createdAt: now, updatedAt: now }
    return this.insertFile(file)
  }
  getFileRecord(id: string): Promise<FileRecord | null> {
    return this.selectOne('overlay_files', id, mapFile)
  }
  updateFileRecord(id: string, patch: Partial<FileRecord>): Promise<FileRecord> {
    return this.genericJsonUpdate('overlay_files', id, patch, mapFile)
  }
  async deleteFileRecord(id: string): Promise<void> {
    await this.query('DELETE FROM overlay_files WHERE id=$1', [id])
  }
  async listFileRecords(userId: string, opts?: ListOptions): Promise<FileRecord[]> {
    const rows = await this.query('SELECT * FROM overlay_files WHERE user_id=$1 ORDER BY updated_at DESC LIMIT $2', [userId, opts?.limit ?? 100])
    return rows.map(mapFile)
  }

  createNote(data: NewNote): Promise<Note> {
    const now = nowMs()
    const next = withDefaultOrg(data, this.defaultOrgId)
    const note: Note = { id: newId('note'), orgId: next.orgId, title: next.title, content: next.content, tags: next.tags ?? [], userId: next.userId, projectId: next.projectId, createdAt: now, updatedAt: now }
    return this.insertNote(note)
  }
  getNote(id: string): Promise<Note | null> {
    return this.selectOne('overlay_notes', id, mapNote)
  }
  updateNote(id: string, patch: Partial<Note>): Promise<Note> {
    return this.genericJsonUpdate('overlay_notes', id, patch, mapNote)
  }
  async deleteNote(id: string): Promise<void> {
    await this.query('DELETE FROM overlay_notes WHERE id=$1', [id])
  }
  async listNotes(userId: string, opts?: ListOptions): Promise<Note[]> {
    const rows = await this.query('SELECT * FROM overlay_notes WHERE user_id=$1 ORDER BY updated_at DESC LIMIT $2', [userId, opts?.limit ?? 100])
    return rows.map(mapNote)
  }

  createOutput(data: NewOutputRecord): Promise<OutputRecord> {
    return this.insertJsonBacked<OutputRecord, NewOutputRecord>('overlay_outputs', 'out', data, mapOutput)
  }
  getOutput(id: string): Promise<OutputRecord | null> {
    return this.selectOne('overlay_outputs', id, mapOutput)
  }
  updateOutput(id: string, patch: Partial<OutputRecord>): Promise<OutputRecord> {
    return this.genericJsonUpdate('overlay_outputs', id, patch, mapOutput)
  }
  async listOutputs(userId: string, opts?: ListOptions): Promise<OutputRecord[]> {
    const rows = await this.query('SELECT * FROM overlay_outputs WHERE user_id=$1 ORDER BY updated_at DESC LIMIT $2', [userId, opts?.limit ?? 100])
    return rows.map(mapOutput)
  }

  async listSkills(userId: string, opts?: ListOptions): Promise<SkillRecord[]> {
    const rows = await this.query('SELECT * FROM overlay_skills WHERE user_id=$1 ORDER BY updated_at DESC LIMIT $2', [userId, opts?.limit ?? 100])
    return rows.map(mapSkill)
  }
  async listMcpServers(userId: string, opts?: ListOptions): Promise<McpServerRecord[]> {
    const rows = await this.query('SELECT * FROM overlay_mcp_servers WHERE user_id=$1 ORDER BY updated_at DESC LIMIT $2', [userId, opts?.limit ?? 100])
    return rows.map(mapMcpServer)
  }
  async getEntitlements(userId: string): Promise<UsageEntitlements | null> {
    const rows = await this.query('SELECT * FROM overlay_usage_entitlements WHERE user_id=$1 LIMIT 1', [userId])
    return rows[0] ? mapEntitlements(rows[0]) : null
  }
  async recordUsage(userId: string, events: Array<Record<string, unknown>>): Promise<void> {
    await this.recordDatabaseAuditEvent({ orgId: this.defaultOrgId, userId, action: 'usage.record', metadata: { events } })
  }
  async getSettings(userId: string): Promise<AppSettings | null> {
    const rows = await this.query('SELECT * FROM overlay_settings WHERE user_id=$1 LIMIT 1', [userId])
    return rows[0] ? mapSettings(rows[0]) : null
  }
  async updateSettings(userId: string, settings: Record<string, unknown>): Promise<AppSettings> {
    const updatedAt = nowMs()
    await this.query(
      `INSERT INTO overlay_settings (org_id, user_id, settings, updated_at) VALUES ($1,$2,$3,$4)
       ON CONFLICT (org_id, user_id) DO UPDATE SET settings=EXCLUDED.settings, updated_at=EXCLUDED.updated_at`,
      [this.defaultOrgId, userId, JSON.stringify(settings), updatedAt],
    )
    return { orgId: this.defaultOrgId, userId, settings, updatedAt }
  }
  async getOnboardingStatus(userId: string): Promise<{ hasSeenOnboarding: boolean }> {
    const rows = await this.query('SELECT has_seen_onboarding FROM overlay_onboarding WHERE user_id=$1 LIMIT 1', [userId])
    return { hasSeenOnboarding: Boolean(rows[0]?.has_seen_onboarding) }
  }
  async markOnboardingComplete(userId: string): Promise<void> {
    await this.setOnboarding(userId, true)
  }
  async resetOnboarding(userId: string): Promise<void> {
    await this.setOnboarding(userId, false)
  }
  async listAutomations(userId: string, opts?: ListOptions): Promise<AutomationRecord[]> {
    const rows = await this.query('SELECT * FROM overlay_automations WHERE user_id=$1 ORDER BY updated_at DESC LIMIT $2', [userId, opts?.limit ?? 100])
    return rows.map(mapAutomation)
  }
  async recordDatabaseAuditEvent(event: Omit<DatabaseAuditEvent, 'id' | 'createdAt'>): Promise<DatabaseAuditEvent> {
    const audit: DatabaseAuditEvent = { ...event, id: newId('audit'), createdAt: nowMs() }
    await this.query(
      'INSERT INTO overlay_audit_events (id, org_id, user_id, action, resource_type, resource_id, metadata, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
      [audit.id, audit.orgId, audit.userId ?? null, audit.action, audit.resourceType ?? null, audit.resourceId ?? null, JSON.stringify(audit.metadata ?? {}), audit.createdAt],
    )
    return audit
  }
  async listDatabaseAuditEvents(orgId: string, opts?: ListOptions): Promise<DatabaseAuditEvent[]> {
    const rows = await this.query('SELECT * FROM overlay_audit_events WHERE org_id=$1 ORDER BY created_at DESC LIMIT $2', [orgId, opts?.limit ?? 100])
    return rows.map(mapAudit)
  }

  private async getPool(): Promise<PgPool> {
    if (this.pool) return this.pool
    const load = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<PgModule>
    const pg = await load('pg')
    this.pool = new pg.Pool({
      connectionString: this.options.url,
      max: this.options.pool?.max ?? 10,
      idleTimeoutMillis: this.options.pool?.idleTimeoutMillis ?? 30_000,
    })
    return this.pool
  }

  private async query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
    const pool = await this.getPool()
    const result = await pool.query<T>(sql, params)
    return result.rows
  }

  private async ensureDefaultOrg(): Promise<void> {
    await this.createOrganization({ id: this.defaultOrgId, name: 'Default organization', slug: 'default' })
  }

  private async selectOne<T>(table: string, id: string, mapper: (row: Record<string, unknown>) => T): Promise<T | null> {
    const rows = await this.query(`SELECT * FROM ${quoteIdent(table)} WHERE id=$1`, [id])
    return rows[0] ? mapper(rows[0]) : null
  }

  private async insertMemory(memory: Memory): Promise<Memory> {
    await this.query(
      `INSERT INTO overlay_memories (id, org_id, user_id, key, segment_index, content, full_content, source, type, importance, project_id, conversation_id, note_id, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [memory.id, memory.orgId, memory.userId, memory.key, memory.segmentIndex, memory.content, memory.fullContent, memory.source, memory.type ?? null, memory.importance ?? null, memory.projectId ?? null, memory.conversationId ?? null, memory.noteId ?? null, memory.createdAt, memory.updatedAt ?? null],
    )
    return memory
  }

  private async insertFile(file: FileRecord): Promise<FileRecord> {
    await this.query(
      `INSERT INTO overlay_files (id, org_id, user_id, project_id, name, type, parent_id, content, size_bytes, is_storage_backed, storage_key, download_url, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [file.id, file.orgId, file.userId, file.projectId ?? null, file.name, file.type, file.parentId, file.content ?? null, file.sizeBytes ?? null, file.isStorageBacked ?? false, file.storageKey ?? null, file.downloadUrl ?? null, file.createdAt, file.updatedAt],
    )
    return file
  }

  private async insertNote(note: Note): Promise<Note> {
    await this.query(
      'INSERT INTO overlay_notes (id, org_id, user_id, project_id, title, content, tags, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      [note.id, note.orgId, note.userId, note.projectId ?? null, note.title, note.content, JSON.stringify(note.tags), note.createdAt, note.updatedAt],
    )
    return note
  }

  private async insertJsonBacked<T extends { id: string; createdAt: number; updatedAt: number }, N extends { orgId?: string; userId: string }>(
    table: string,
    prefix: string,
    data: N,
    mapper: (row: Record<string, unknown>) => T,
  ): Promise<T> {
    const now = nowMs()
    const next = withDefaultOrg(data, this.defaultOrgId)
    const row = { id: newId(prefix), ...next, createdAt: now, updatedAt: now }
    const columns = Object.keys(row).map(camelToSnake)
    const values = Object.values(row).map(serialize)
    const placeholders = values.map((_, index) => `$${index + 1}`)
    await this.query(`INSERT INTO ${quoteIdent(table)} (${columns.map(quoteIdent).join(', ')}) VALUES (${placeholders.join(', ')})`, values)
    const inserted = await this.selectOne(table, row.id, mapper)
    if (!inserted) throw new Error(`Failed to insert ${table} row.`)
    return inserted
  }

  private async genericJsonUpdate<T>(table: string, id: string, patch: Partial<T>, mapper: (row: Record<string, unknown>) => T): Promise<T> {
    const existing = await this.selectOne(table, id, mapper)
    if (!existing) throw new Error(`Row not found: ${id}`)
    const entries = Object.entries({ ...patch, updatedAt: nowMs() }).filter(([, value]) => value !== undefined)
    const assignments = entries.map(([key], index) => `${quoteIdent(camelToSnake(key))}=$${index + 2}`)
    await this.query(`UPDATE ${quoteIdent(table)} SET ${assignments.join(', ')} WHERE id=$1`, [id, ...entries.map(([, value]) => serialize(value))])
    const updated = await this.selectOne(table, id, mapper)
    if (!updated) throw new Error(`Row not found after update: ${id}`)
    return updated
  }

  private async updateKnownProject(id: string, patch: Partial<Project>): Promise<Project> {
    return this.genericJsonUpdate('overlay_projects', id, patch, mapProject)
  }

  private async setOnboarding(userId: string, hasSeenOnboarding: boolean): Promise<void> {
    await this.query(
      `INSERT INTO overlay_onboarding (org_id, user_id, has_seen_onboarding, updated_at) VALUES ($1,$2,$3,$4)
       ON CONFLICT (org_id, user_id) DO UPDATE SET has_seen_onboarding=EXCLUDED.has_seen_onboarding, updated_at=EXCLUDED.updated_at`,
      [this.defaultOrgId, userId, hasSeenOnboarding, nowMs()],
    )
  }
}

function quoteIdent(identifier: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) throw new Error(`Invalid SQL identifier: ${identifier}`)
  return `"${identifier}"`
}

function camelToSnake(value: string): string {
  return value.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
}

function serialize(value: unknown): unknown {
  if (value && typeof value === 'object') return JSON.stringify(value)
  return value ?? null
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T
    } catch {
      return fallback
    }
  }
  return value as T
}

function str(row: Record<string, unknown>, key: string): string {
  return String(row[key] ?? '')
}

function num(row: Record<string, unknown>, key: string): number {
  return Number(row[key] ?? 0)
}

function mapOrg(row: Record<string, unknown>): Organization {
  return { id: str(row, 'id'), name: str(row, 'name'), slug: row.slug ? str(row, 'slug') : undefined, createdAt: num(row, 'created_at'), updatedAt: num(row, 'updated_at') }
}
function mapUser(row: Record<string, unknown>): User {
  return { id: str(row, 'id'), orgId: str(row, 'org_id'), email: str(row, 'email'), firstName: row.first_name ? str(row, 'first_name') : undefined, lastName: row.last_name ? str(row, 'last_name') : undefined, profilePictureUrl: row.profile_picture_url ? str(row, 'profile_picture_url') : undefined, emailVerified: Boolean(row.email_verified), role: row.role as User['role'], createdAt: num(row, 'created_at'), updatedAt: num(row, 'updated_at') }
}
function mapConversation(row: Record<string, unknown>): Conversation {
  return { id: str(row, 'id'), orgId: str(row, 'org_id'), userId: str(row, 'user_id'), projectId: row.project_id ? str(row, 'project_id') : undefined, title: str(row, 'title'), lastMode: row.last_mode as Conversation['lastMode'], askModelIds: parseJson<string[]>(row.ask_model_ids, []), actModelId: str(row, 'act_model_id'), lastModified: num(row, 'last_modified'), deletedAt: row.deleted_at ? num(row, 'deleted_at') : undefined, createdAt: num(row, 'created_at'), updatedAt: num(row, 'updated_at') }
}
function mapMessage(row: Record<string, unknown>): ConversationMessage {
  return { id: str(row, 'id'), orgId: str(row, 'org_id'), conversationId: str(row, 'conversation_id'), userId: str(row, 'user_id'), role: row.role as ConversationMessage['role'], content: str(row, 'content'), status: row.status as ConversationMessage['status'], modelId: row.model_id ? str(row, 'model_id') : undefined, metadata: parseJson<Record<string, unknown>>(row.metadata, {}), createdAt: num(row, 'created_at'), updatedAt: num(row, 'updated_at') }
}
function mapProject(row: Record<string, unknown>): Project {
  return { id: str(row, 'id'), orgId: str(row, 'org_id'), userId: str(row, 'user_id'), name: str(row, 'name'), parentId: row.parent_id ? str(row, 'parent_id') : undefined, instructions: row.instructions ? str(row, 'instructions') : undefined, deletedAt: row.deleted_at ? num(row, 'deleted_at') : undefined, createdAt: num(row, 'created_at'), updatedAt: num(row, 'updated_at') }
}
function mapMemory(row: Record<string, unknown>): Memory {
  return { id: str(row, 'id'), orgId: str(row, 'org_id'), userId: str(row, 'user_id'), key: str(row, 'key'), segmentIndex: num(row, 'segment_index'), content: str(row, 'content'), fullContent: str(row, 'full_content'), source: str(row, 'source'), type: row.type as Memory['type'], importance: row.importance ? num(row, 'importance') : undefined, projectId: row.project_id ? str(row, 'project_id') : undefined, conversationId: row.conversation_id ? str(row, 'conversation_id') : undefined, noteId: row.note_id ? str(row, 'note_id') : undefined, createdAt: num(row, 'created_at'), updatedAt: row.updated_at ? num(row, 'updated_at') : undefined }
}
function mapFile(row: Record<string, unknown>): FileRecord {
  return { id: str(row, 'id'), orgId: str(row, 'org_id'), userId: str(row, 'user_id'), projectId: row.project_id ? str(row, 'project_id') : undefined, name: str(row, 'name'), type: row.type as FileRecord['type'], parentId: row.parent_id ? str(row, 'parent_id') : null, content: row.content ? str(row, 'content') : undefined, sizeBytes: row.size_bytes ? num(row, 'size_bytes') : undefined, isStorageBacked: Boolean(row.is_storage_backed), storageKey: row.storage_key ? str(row, 'storage_key') : undefined, downloadUrl: row.download_url ? str(row, 'download_url') : undefined, createdAt: num(row, 'created_at'), updatedAt: num(row, 'updated_at') }
}
function mapNote(row: Record<string, unknown>): Note {
  return { id: str(row, 'id'), orgId: str(row, 'org_id'), userId: str(row, 'user_id'), projectId: row.project_id ? str(row, 'project_id') : undefined, title: str(row, 'title'), content: str(row, 'content'), tags: parseJson<string[]>(row.tags, []), createdAt: num(row, 'created_at'), updatedAt: num(row, 'updated_at') }
}
function mapOutput(row: Record<string, unknown>): OutputRecord {
  return { id: str(row, 'id'), orgId: str(row, 'org_id'), userId: str(row, 'user_id'), type: row.type as OutputRecord['type'], storageKey: row.storage_key ? str(row, 'storage_key') : undefined, status: row.status as OutputRecord['status'], metadata: parseJson<Record<string, unknown>>(row.metadata, {}), createdAt: num(row, 'created_at'), updatedAt: num(row, 'updated_at') }
}
function mapSkill(row: Record<string, unknown>): SkillRecord {
  return { id: str(row, 'id'), orgId: str(row, 'org_id'), userId: str(row, 'user_id'), name: str(row, 'name'), content: str(row, 'content'), enabled: Boolean(row.enabled), createdAt: num(row, 'created_at'), updatedAt: num(row, 'updated_at') }
}
function mapMcpServer(row: Record<string, unknown>): McpServerRecord {
  return { id: str(row, 'id'), orgId: str(row, 'org_id'), userId: str(row, 'user_id'), name: str(row, 'name'), url: row.url ? str(row, 'url') : undefined, config: parseJson<Record<string, unknown>>(row.config, {}), enabled: Boolean(row.enabled), createdAt: num(row, 'created_at'), updatedAt: num(row, 'updated_at') }
}
function mapEntitlements(row: Record<string, unknown>): UsageEntitlements {
  return { orgId: str(row, 'org_id'), userId: str(row, 'user_id'), tier: row.tier as UsageEntitlements['tier'], planKind: row.plan_kind as UsageEntitlements['planKind'], dailyUsage: parseJson<Record<string, number>>(row.daily_usage, {}), dailyLimits: parseJson<Record<string, number>>(row.daily_limits, {}), budgetUsedCents: num(row, 'budget_used_cents'), budgetTotalCents: num(row, 'budget_total_cents'), resetAt: row.reset_at ? num(row, 'reset_at') : undefined, billingPeriodEnd: row.billing_period_end ? num(row, 'billing_period_end') : undefined, lastSyncedAt: row.last_synced_at ? num(row, 'last_synced_at') : undefined }
}
function mapSettings(row: Record<string, unknown>): AppSettings {
  return { orgId: str(row, 'org_id'), userId: str(row, 'user_id'), settings: parseJson<Record<string, unknown>>(row.settings, {}), updatedAt: num(row, 'updated_at') }
}
function mapAutomation(row: Record<string, unknown>): AutomationRecord {
  return { id: str(row, 'id'), orgId: str(row, 'org_id'), userId: str(row, 'user_id'), name: str(row, 'name'), status: row.status as AutomationRecord['status'], schedule: row.schedule ? str(row, 'schedule') : undefined, payload: parseJson<Record<string, unknown>>(row.payload, {}), createdAt: num(row, 'created_at'), updatedAt: num(row, 'updated_at') }
}
function mapAudit(row: Record<string, unknown>): DatabaseAuditEvent {
  return { id: str(row, 'id'), orgId: str(row, 'org_id'), userId: row.user_id ? str(row, 'user_id') : undefined, action: str(row, 'action'), resourceType: row.resource_type ? str(row, 'resource_type') : undefined, resourceId: row.resource_id ? str(row, 'resource_id') : undefined, metadata: parseJson<Record<string, unknown>>(row.metadata, {}), createdAt: num(row, 'created_at') }
}
