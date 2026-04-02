/**
 * Virtual segments for the Knowledge sidebar only.
 * One Convex `memories` row can produce many short rows in the UI (better scanability + search still uses full content via chunking).
 */
const TARGET_CHARS = 300
const HARD_CAP = 480

/**
 * Split memory text into ~TARGET_CHARS segments (sentence / paragraph aware).
 */
export function segmentMemoryForSidebarDisplay(text: string): string[] {
  const t = text.trim()
  if (!t.length) return []
  if (t.length <= TARGET_CHARS) return [t]

  // Paragraphs first, then sentences within blocks
  const blocks = t.split(/\n\n+/)
  const sentences: string[] = []
  for (const block of blocks) {
    const b = block.trim()
    if (!b) continue
    const parts = b.split(/(?<=[.!?])\s+/).filter((p) => p.trim())
    if (parts.length > 0) {
      sentences.push(...parts.map((p) => p.trim()))
    } else {
      sentences.push(b)
    }
  }

  const out: string[] = []
  let buf = ''

  const flush = (): void => {
    const s = buf.trim()
    if (s) out.push(s)
    buf = ''
  }

  const pushHardSlices = (s: string): void => {
    for (let i = 0; i < s.length; i += HARD_CAP) {
      out.push(s.slice(i, i + HARD_CAP))
    }
  }

  for (const sent of sentences) {
    if (sent.length > HARD_CAP) {
      flush()
      pushHardSlices(sent)
      continue
    }

    const candidate = buf ? `${buf} ${sent}` : sent
    if (candidate.length <= TARGET_CHARS) {
      buf = candidate
      continue
    }

    if (buf.trim().length >= 40) {
      flush()
    }

    if (sent.length <= TARGET_CHARS) {
      buf = sent
    } else {
      flush()
      buf = sent
    }

    if (buf.length > HARD_CAP) {
      flush()
      pushHardSlices(sent)
      buf = ''
    }
  }
  flush()

  return out.length > 0 ? out : [t.slice(0, TARGET_CHARS)]
}

export type MemoryRowForSidebar = {
  key: string
  memoryId: string
  segmentIndex: number
  content: string
  fullContent: string
  source: string
  type?: 'preference' | 'fact' | 'project' | 'decision' | 'agent'
  importance?: number
  projectId?: string
  conversationId?: string
  noteId?: string
  messageId?: string
  turnId?: string
  tags?: string[]
  actor?: 'user' | 'agent'
  status?: 'candidate' | 'approved' | 'rejected'
  createdAt: number
  updatedAt?: number
}

/** One Convex memory row → many sidebar rows (virtual segments). */
export function expandMemoriesForSidebarList(
  memories: Array<{
    _id: string
    content: string
    source: string
    type?: 'preference' | 'fact' | 'project' | 'decision' | 'agent'
    importance?: number
    projectId?: string
    conversationId?: string
    noteId?: string
    messageId?: string
    turnId?: string
    tags?: string[]
    actor?: 'user' | 'agent'
    status?: 'candidate' | 'approved' | 'rejected'
    createdAt: number
    updatedAt?: number
  }>,
): MemoryRowForSidebar[] {
  const rows: MemoryRowForSidebar[] = []
  for (const m of memories) {
    const segs = segmentMemoryForSidebarDisplay(m.content)
    segs.forEach((preview, i) => {
      rows.push({
        key: `${m._id}:${i}`,
        memoryId: m._id,
        segmentIndex: i,
        content: preview,
        fullContent: m.content,
        source: m.source,
        type: m.type,
        importance: m.importance,
        projectId: m.projectId,
        conversationId: m.conversationId,
        noteId: m.noteId,
        messageId: m.messageId,
        turnId: m.turnId,
        tags: m.tags,
        actor: m.actor,
        status: m.status,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
      })
    })
  }
  return rows
}
