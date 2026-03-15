type ChatRole = 'user' | 'assistant'
type MemorySource = 'chat' | 'note' | 'manual'

export interface StoredAgent {
  _id: string
  userId: string
  title: string
  lastModified: number
}

export interface StoredAgentMessage {
  _id: string
  agentId: string
  userId: string
  role: ChatRole
  content: string
  createdAt: number
}

export interface StoredChat {
  _id: string
  userId: string
  title: string
  folderId?: string
  lastModified: number
  model: string
}

export interface StoredMessage {
  _id: string
  chatId: string
  userId: string
  role: ChatRole
  content: string
  model?: string
  tokens?: { input: number; output: number }
  createdAt: number
}

export interface StoredNote {
  _id: string
  userId: string
  title: string
  content: string
  tags: string[]
  updatedAt: number
}

export interface StoredMemory {
  _id: string
  userId: string
  content: string
  source: MemorySource
  createdAt: number
}

type StoreState = {
  chats: StoredChat[]
  messages: StoredMessage[]
  notes: StoredNote[]
  memories: StoredMemory[]
  agents: StoredAgent[]
  agentMessages: StoredAgentMessage[]
}

const globalStore = globalThis as typeof globalThis & {
  __overlayAppStore?: StoreState
}

function getStore(): StoreState {
  if (!globalStore.__overlayAppStore) {
    globalStore.__overlayAppStore = {
      chats: [],
      messages: [],
      notes: [],
      memories: [],
      agents: [],
      agentMessages: [],
    }
  }

  return globalStore.__overlayAppStore
}

function createId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

export function listChats(userId: string): StoredChat[] {
  return getStore()
    .chats
    .filter((chat) => chat.userId === userId)
    .sort((a, b) => b.lastModified - a.lastModified)
}

export function createChat(userId: string, title: string, model: string): string {
  const chatId = createId('chat')
  getStore().chats.push({
    _id: chatId,
    userId,
    title,
    model,
    lastModified: Date.now(),
  })
  return chatId
}

export function deleteChat(chatId: string): void {
  const store = getStore()
  store.chats = store.chats.filter((chat) => chat._id !== chatId)
  store.messages = store.messages.filter((message) => message.chatId !== chatId)
}

export function listMessages(chatId: string): StoredMessage[] {
  return getStore()
    .messages
    .filter((message) => message.chatId === chatId)
    .sort((a, b) => a.createdAt - b.createdAt)
}

export function addMessage(args: {
  chatId: string
  userId: string
  role: ChatRole
  content: string
  model?: string
  tokens?: { input: number; output: number }
}): string {
  const store = getStore()
  const messageId = createId('msg')
  const createdAt = Date.now()

  store.messages.push({
    _id: messageId,
    createdAt,
    ...args,
  })

  const chat = store.chats.find((entry) => entry._id === args.chatId)
  if (chat) {
    chat.lastModified = createdAt
    if (args.role === 'user' && chat.title === 'New Chat') {
      chat.title = args.content.slice(0, 48) || chat.title
    }
    if (args.model) {
      chat.model = args.model
    }
  }

  return messageId
}

export function listNotes(userId: string): StoredNote[] {
  return getStore()
    .notes
    .filter((note) => note.userId === userId)
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

export function createNote(userId: string, title: string, content: string, tags: string[]): string {
  const noteId = createId('note')
  getStore().notes.push({
    _id: noteId,
    userId,
    title,
    content,
    tags,
    updatedAt: Date.now(),
  })
  return noteId
}

export function updateNote(noteId: string, updates: {
  title?: string
  content?: string
  tags?: string[]
}): boolean {
  const note = getStore().notes.find((entry) => entry._id === noteId)
  if (!note) return false

  if (updates.title !== undefined) note.title = updates.title
  if (updates.content !== undefined) note.content = updates.content
  if (updates.tags !== undefined) note.tags = updates.tags
  note.updatedAt = Date.now()
  return true
}

export function deleteNote(noteId: string): void {
  const store = getStore()
  store.notes = store.notes.filter((note) => note._id !== noteId)
}

export function listMemories(userId: string): StoredMemory[] {
  return getStore()
    .memories
    .filter((memory) => memory.userId === userId)
    .sort((a, b) => b.createdAt - a.createdAt)
}

export function addMemory(userId: string, content: string, source: MemorySource): string {
  const memoryId = createId('memory')
  getStore().memories.push({
    _id: memoryId,
    userId,
    content,
    source,
    createdAt: Date.now(),
  })
  return memoryId
}

export function removeMemory(memoryId: string): void {
  const store = getStore()
  store.memories = store.memories.filter((memory) => memory._id !== memoryId)
}

export function listAgents(userId: string): StoredAgent[] {
  return getStore()
    .agents
    .filter((agent) => agent.userId === userId)
    .sort((a, b) => b.lastModified - a.lastModified)
}

export function createAgent(userId: string, title: string): string {
  const agentId = createId('agent')
  getStore().agents.push({
    _id: agentId,
    userId,
    title,
    lastModified: Date.now(),
  })
  return agentId
}

export function deleteAgent(agentId: string): void {
  const store = getStore()
  store.agents = store.agents.filter((a) => a._id !== agentId)
  store.agentMessages = store.agentMessages.filter((m) => m.agentId !== agentId)
}

export function listAgentMessages(agentId: string): StoredAgentMessage[] {
  return getStore()
    .agentMessages
    .filter((m) => m.agentId === agentId)
    .sort((a, b) => a.createdAt - b.createdAt)
}

export function addAgentMessage(args: {
  agentId: string
  userId: string
  role: ChatRole
  content: string
}): string {
  const store = getStore()
  const messageId = createId('amsg')
  const createdAt = Date.now()

  store.agentMessages.push({
    _id: messageId,
    createdAt,
    ...args,
  })

  const agent = store.agents.find((a) => a._id === args.agentId)
  if (agent) {
    agent.lastModified = createdAt
    if (args.role === 'user' && agent.title === 'New Agent') {
      agent.title = args.content.slice(0, 48) || agent.title
    }
  }

  return messageId
}
