import { convex } from '@/lib/convex'
import type { HybridSearchChunk } from '../../convex/knowledge'

/** Retrieval-only context for the model. Durable facts the user wants remembered are written via save_memory (Ask or Act), not here. */

const MIN_USER_CHARS = 8
const MAX_QUERY_CHARS = 500
const BLOCK_CHAR_BUDGET = 9000

/** 1-based citation index → notebook file or memory (for UI links). */
export type SourceCitationMap = Record<string, { kind: 'file' | 'memory'; sourceId: string }>

export type AutoRetrievalBundle = {
  extension: string
  citations: SourceCitationMap
}

/**
 * Hybrid search for the latest user message: system extension + citation map for **Sources:** links.
 */
export async function buildAutoRetrievalBundle(args: {
  userMessage: string
  userId: string
  accessToken: string
  projectId?: string
}): Promise<AutoRetrievalBundle> {
  const q = args.userMessage.trim()
  if (q.length < MIN_USER_CHARS) {
    return { extension: '', citations: {} }
  }

  try {
    const result = await convex.action<{ chunks: HybridSearchChunk[] } | null>('knowledge:hybridSearch', {
      accessToken: args.accessToken,
      userId: args.userId,
      query: q.slice(0, MAX_QUERY_CHARS),
      projectId: args.projectId,
      m: 10,
      kVec: 40,
      kLex: 40,
    })
    const chunks = result?.chunks ?? []
    if (chunks.length === 0) {
      return { extension: '', citations: {} }
    }

    const citations: SourceCitationMap = {}
    const lines: string[] = [
      '---',
      'AUTO_RETRIEVED_KNOWLEDGE (from the user\'s indexed notebook files and saved memories).',
      'Some items may be irrelevant — ignore what does not apply.',
      'If you use any passage below in your answer, end your reply with a **Sources:** line listing only the numbers you used, using ASCII brackets, e.g. `Sources: [1], [2], [3]`.',
      '---',
    ]

    let used = 0
    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i]!
      const kind = c.sourceKind === 'file' ? 'file' : 'memory'
      const title =
        (c.title && c.title.trim()) || (kind === 'file' ? 'Notebook file' : 'Memory')
      const n = i + 1
      citations[String(n)] = { kind: c.sourceKind, sourceId: c.sourceId }
      const block = `[${n}] (${kind}) ${title}\n${c.text}`
      if (used + block.length > BLOCK_CHAR_BUDGET) break
      lines.push(block, '')
      used += block.length
    }

    return { extension: '\n\n' + lines.join('\n'), citations }
  } catch (e) {
    console.warn('[ask-knowledge-context] hybridSearch failed:', e)
    return { extension: '', citations: {} }
  }
}

/**
 * @deprecated Prefer {@link buildAutoRetrievalBundle} when you need citation metadata.
 */
export async function buildAutoRetrievalSystemExtension(args: {
  userMessage: string
  userId: string
  accessToken: string
  projectId?: string
}): Promise<string> {
  const { extension } = await buildAutoRetrievalBundle(args)
  return extension
}
