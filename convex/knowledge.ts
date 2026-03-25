import { v } from 'convex/values'
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
} from './_generated/server'
import { internal, api } from './_generated/api'
import type { Doc, Id } from './_generated/dataModel'
import { requireAccessToken } from './lib/auth'

export type HybridSearchChunk = {
  text: string
  title?: string
  sourceKind: 'file' | 'memory'
  sourceId: string
  chunkIndex: number
  score: number
}

/** ~250–300 tokens; overlap preserves boundary context */
export const CHUNK_CHARS = 1000
export const CHUNK_OVERLAP = 120
const RRF_K = 60
const EMBEDDING_MODEL = 'openai/text-embedding-3-small'
const EMBEDDING_DIM = 1536
const GATEWAY_EMBED_URL = 'https://ai-gateway.vercel.sh/v1/embeddings'

export function chunkText(full: string): Array<{ text: string; chunkIndex: number; startOffset: number }> {
  const trimmed = full.trim()
  if (!trimmed) return []
  const chunks: Array<{ text: string; chunkIndex: number; startOffset: number }> = []
  let start = 0
  let idx = 0
  while (start < trimmed.length) {
    const end = Math.min(start + CHUNK_CHARS, trimmed.length)
    chunks.push({
      text: trimmed.slice(start, end),
      chunkIndex: idx++,
      startOffset: start,
    })
    if (end === trimmed.length) break
    start = Math.max(0, end - CHUNK_OVERLAP)
  }
  return chunks
}

function truncateSearchQuery(q: string, maxTerms = 16): string {
  const terms = q.trim().split(/\s+/).filter(Boolean)
  return terms.slice(0, maxTerms).join(' ')
}

async function embedViaGateway(texts: string[]): Promise<{ vectors: number[][]; promptTokens: number }> {
  const key = process.env.AI_GATEWAY_API_KEY || process.env.OPENAI_API_KEY
  if (!key) {
    throw new Error('Missing AI_GATEWAY_API_KEY or OPENAI_API_KEY in Convex environment')
  }
  const res = await fetch(GATEWAY_EMBED_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: texts.length === 1 ? texts[0]! : texts,
    }),
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Embeddings HTTP ${res.status}: ${t.slice(0, 500)}`)
  }
  const data = (await res.json()) as {
    data: Array<{ embedding: number[]; index: number }>
    usage?: { prompt_tokens?: number; total_tokens?: number }
  }
  const sorted = [...data.data].sort((a, b) => a.index - b.index)
  const vectors = sorted.map((d) => {
    const e = d.embedding
    if (e.length !== EMBEDDING_DIM) {
      throw new Error(`Expected ${EMBEDDING_DIM} dims, got ${e.length}`)
    }
    return e
  })
  const promptTokens = data.usage?.prompt_tokens ?? data.usage?.total_tokens ?? 0
  return { vectors, promptTokens }
}

// ─── Internal: purge + replace indexed content ───────────────────────────────

export const purgeKnowledgeSource = internalMutation({
  args: {
    sourceKind: v.union(v.literal('file'), v.literal('memory')),
    sourceId: v.string(),
  },
  handler: async (ctx, { sourceKind, sourceId }) => {
    const existing = await ctx.db
      .query('knowledgeChunks')
      .withIndex('by_source', (q) => q.eq('sourceKind', sourceKind).eq('sourceId', sourceId))
      .collect()
    for (const c of existing) {
      const emb = await ctx.db
        .query('knowledgeChunkEmbeddings')
        .withIndex('by_chunkId', (q) => q.eq('chunkId', c._id))
        .first()
      if (emb) await ctx.db.delete(emb._id)
      await ctx.db.delete(c._id)
    }
  },
})

export const replaceKnowledgeSource = internalMutation({
  args: {
    userId: v.string(),
    projectId: v.optional(v.string()),
    sourceKind: v.union(v.literal('file'), v.literal('memory')),
    sourceId: v.string(),
    title: v.optional(v.string()),
    segments: v.array(
      v.object({
        text: v.string(),
        chunkIndex: v.number(),
        startOffset: v.number(),
        embedding: v.array(v.float64()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('knowledgeChunks')
      .withIndex('by_source', (q) => q.eq('sourceKind', args.sourceKind).eq('sourceId', args.sourceId))
      .collect()
    for (const c of existing) {
      const emb = await ctx.db
        .query('knowledgeChunkEmbeddings')
        .withIndex('by_chunkId', (q) => q.eq('chunkId', c._id))
        .first()
      if (emb) await ctx.db.delete(emb._id)
      await ctx.db.delete(c._id)
    }
    for (const seg of args.segments) {
      const chunkId = await ctx.db.insert('knowledgeChunks', {
        userId: args.userId,
        projectId: args.projectId,
        sourceKind: args.sourceKind,
        sourceId: args.sourceId,
        chunkIndex: seg.chunkIndex,
        startOffset: seg.startOffset,
        text: seg.text,
        title: args.title,
      })
      await ctx.db.insert('knowledgeChunkEmbeddings', {
        chunkId,
        userId: args.userId,
        sourceKind: args.sourceKind,
        embedding: seg.embedding,
      })
    }
  },
})

// ─── Internal queries for hybrid search ──────────────────────────────────────

export const getFileForReindex = internalQuery({
  args: { fileId: v.id('files') },
  handler: async (ctx, { fileId }) => {
    const f = await ctx.db.get(fileId)
    if (!f || f.type !== 'file') return null
    if (f.storageId) return { kind: 'skip' as const, reason: 'binary' as const }
    const content = f.content ?? ''
    return {
      kind: 'ok' as const,
      userId: f.userId,
      projectId: f.projectId,
      name: f.name,
      content,
    }
  },
})

export const getMemoryForReindex = internalQuery({
  args: { memoryId: v.id('memories') },
  handler: async (ctx, { memoryId }) => {
    const m = await ctx.db.get(memoryId)
    if (!m) return null
    return { userId: m.userId, content: m.content }
  },
})

export const searchChunksLexical = internalQuery({
  args: {
    userId: v.string(),
    sourceKind: v.optional(v.union(v.literal('file'), v.literal('memory'))),
    query: v.string(),
    limit: v.number(),
  },
  handler: async (ctx, { userId, sourceKind, query, limit }) => {
    const qStr = truncateSearchQuery(query)
    if (!qStr) return []
    return await ctx.db
      .query('knowledgeChunks')
      .withSearchIndex('search_text', (q) => {
        const chain = q.search('text', qStr).eq('userId', userId)
        if (sourceKind !== undefined) {
          return chain.eq('sourceKind', sourceKind)
        }
        return chain
      })
      .take(limit)
  },
})

export const embeddingChunkIdsForVectorResults = internalQuery({
  args: {
    embeddingIds: v.array(v.id('knowledgeChunkEmbeddings')),
    sourceKind: v.optional(v.union(v.literal('file'), v.literal('memory'))),
  },
  handler: async (ctx, { embeddingIds, sourceKind }) => {
    const ordered: Array<{ chunkId: Id<'knowledgeChunks'> | null }> = []
    for (const id of embeddingIds) {
      const row = await ctx.db.get(id)
      if (!row) {
        ordered.push({ chunkId: null })
        continue
      }
      if (sourceKind !== undefined && row.sourceKind !== sourceKind) {
        ordered.push({ chunkId: null })
        continue
      }
      ordered.push({ chunkId: row.chunkId })
    }
    return ordered
  },
})

export const fetchChunkPayloads = internalQuery({
  args: { ids: v.array(v.id('knowledgeChunks')) },
  handler: async (ctx, { ids }) => {
    const out = []
    for (const id of ids) {
      const row = await ctx.db.get(id)
      if (row) out.push(row)
    }
    return out
  },
})

// ─── Reindex (scheduled / internal) ─────────────────────────────────────────

export const reindexFileInternal = internalAction({
  args: { fileId: v.id('files') },
  handler: async (ctx, { fileId }) => {
    const meta = await ctx.runQuery(internal.knowledge.getFileForReindex, { fileId })
    if (!meta || meta.kind === 'skip') return
    const { userId, projectId, name, content } = meta
    const segments = chunkText(content)
    if (segments.length === 0) {
      await ctx.runMutation(internal.knowledge.purgeKnowledgeSource, {
        sourceKind: 'file',
        sourceId: fileId,
      })
      return
    }
    const BATCH = 32
    const allEmb: number[][] = []
    let totalTokens = 0
    for (let i = 0; i < segments.length; i += BATCH) {
      const batch = segments.slice(i, i + BATCH).map((s) => s.text)
      const { vectors, promptTokens } = await embedViaGateway(batch)
      allEmb.push(...vectors)
      totalTokens += promptTokens
    }
    void totalTokens
    await ctx.runMutation(internal.knowledge.replaceKnowledgeSource, {
      userId,
      projectId,
      sourceKind: 'file',
      sourceId: fileId,
      title: name,
      segments: segments.map((s, i) => ({
        text: s.text,
        chunkIndex: s.chunkIndex,
        startOffset: s.startOffset,
        embedding: allEmb[i]!,
      })),
    })
  },
})

export const reindexMemoryInternal = internalAction({
  args: { memoryId: v.id('memories') },
  handler: async (ctx, { memoryId }) => {
    const meta = await ctx.runQuery(internal.knowledge.getMemoryForReindex, { memoryId })
    if (!meta) {
      await ctx.runMutation(internal.knowledge.purgeKnowledgeSource, {
        sourceKind: 'memory',
        sourceId: memoryId,
      })
      return
    }
    const segments = chunkText(meta.content)
    if (segments.length === 0) {
      await ctx.runMutation(internal.knowledge.purgeKnowledgeSource, {
        sourceKind: 'memory',
        sourceId: memoryId,
      })
      return
    }
    const { vectors } = await embedViaGateway(segments.map((s) => s.text))
    await ctx.runMutation(internal.knowledge.replaceKnowledgeSource, {
      userId: meta.userId,
      projectId: undefined,
      sourceKind: 'memory',
      sourceId: memoryId,
      title: 'Memory',
      segments: segments.map((s, i) => ({
        text: s.text,
        chunkIndex: s.chunkIndex,
        startOffset: s.startOffset,
        embedding: vectors[i]!,
      })),
    })
  },
})

function chunkMatchesProject(
  projectId: string | undefined,
  chunkProjectId: string | undefined,
): boolean {
  if (!projectId) return true
  return chunkProjectId === undefined || chunkProjectId === projectId
}

/** Post-processing after RRF: cap total injected characters and diversity per source (step 6). */
const PACK_MAX_TOTAL_CHARS = 12_000
const PACK_MAX_PER_SOURCE = 3

function packChunksForContext(
  ordered: Doc<'knowledgeChunks'>[],
  scores: Map<string, number>,
  maxChunks: number,
): HybridSearchChunk[] {
  const perSource = new Map<string, number>()
  let chars = 0
  const out: HybridSearchChunk[] = []
  for (const row of ordered) {
    if (out.length >= maxChunks) break
    const key = `${row.sourceKind}:${row.sourceId}`
    if ((perSource.get(key) ?? 0) >= PACK_MAX_PER_SOURCE) continue
    const nextLen = row.text.length
    if (chars + nextLen > PACK_MAX_TOTAL_CHARS && out.length > 0) break
    perSource.set(key, (perSource.get(key) ?? 0) + 1)
    chars += nextLen
    out.push({
      text: row.text,
      title: row.title,
      sourceKind: row.sourceKind,
      sourceId: row.sourceId,
      chunkIndex: row.chunkIndex,
      score: scores.get(row._id) ?? 0,
    })
  }
  return out
}

// ─── Public hybrid search (auth via entitlements query) ──────────────────────

export const hybridSearch = action({
  args: {
    accessToken: v.string(),
    userId: v.string(),
    query: v.string(),
    projectId: v.optional(v.string()),
    sourceKind: v.optional(v.union(v.literal('file'), v.literal('memory'))),
    kVec: v.optional(v.number()),
    kLex: v.optional(v.number()),
    m: v.optional(v.number()),
    minVecScore: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<{ chunks: HybridSearchChunk[] }> => {
    await requireAccessToken(args.accessToken, args.userId)

    const kVec = Math.min(256, Math.max(1, args.kVec ?? 48))
    const kLex = Math.min(1024, Math.max(1, args.kLex ?? 48))
    const m = Math.min(50, Math.max(1, args.m ?? 12))
    const q = args.query.trim()
    if (!q) {
      return { chunks: [] }
    }

    const { vectors, promptTokens } = await embedViaGateway([q])
    const vector = vectors[0]!

    if (args.accessToken && promptTokens > 0) {
      try {
        await ctx.runMutation(api.usage.recordBatch, {
          accessToken: args.accessToken,
          userId: args.userId,
          events: [
            {
              type: 'embedding' as const,
              modelId: EMBEDDING_MODEL,
              inputTokens: promptTokens,
              outputTokens: 0,
              cost: 0,
              timestamp: Date.now(),
            },
          ],
        })
      } catch {
        // usage recording is best-effort
      }
    }

    // Vector index filter supports a single equality chain per Convex; filter userId here,
    // then optionally drop rows by sourceKind when resolving embedding → chunk ids.
    let vecRaw = await ctx.vectorSearch('knowledgeChunkEmbeddings', 'by_embedding', {
      vector,
      limit: kVec,
      filter: (fq) => fq.eq('userId', args.userId),
    })
    if (args.minVecScore !== undefined) {
      vecRaw = vecRaw.filter((r) => r._score >= args.minVecScore!)
    }

    const vecOrderedIds = vecRaw.map((r) => r._id)
    const vecChunkPairs: Array<{ chunkId: Id<'knowledgeChunks'> | null }> =
      await ctx.runQuery(internal.knowledge.embeddingChunkIdsForVectorResults, {
        embeddingIds: vecOrderedIds,
        sourceKind: args.sourceKind,
      })

    const scores = new Map<string, number>()
    for (let i = 0; i < vecChunkPairs.length; i++) {
      const cid = vecChunkPairs[i]?.chunkId
      if (!cid) continue
      const rank = i + 1
      scores.set(cid, (scores.get(cid) ?? 0) + 1 / (RRF_K + rank))
    }

    const lexDocs = await ctx.runQuery(internal.knowledge.searchChunksLexical, {
      userId: args.userId,
      sourceKind: args.sourceKind,
      query: q,
      limit: kLex,
    })
    for (let j = 0; j < lexDocs.length; j++) {
      const id = lexDocs[j]!._id
      const rank = j + 1
      scores.set(id, (scores.get(id) ?? 0) + 1 / (RRF_K + rank))
    }

    const rankedIds = [...scores.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => id as Id<'knowledgeChunks'>)

    const payloads: Doc<'knowledgeChunks'>[] = await ctx.runQuery(
      internal.knowledge.fetchChunkPayloads,
      { ids: rankedIds },
    )
    const byId = new Map<Id<'knowledgeChunks'>, Doc<'knowledgeChunks'>>(
      payloads.map((p) => [p._id, p]),
    )
    const filtered = rankedIds
      .map((id) => byId.get(id))
      .filter((row): row is NonNullable<typeof row> => !!row)
      .filter((row) => chunkMatchesProject(args.projectId, row.projectId))

    // Prefer chunks whose file was saved under this project when the user is in a project chat.
    const PROJECT_CHUNK_BOOST = 1.85
    const boostedScores = new Map(scores)
    if (args.projectId) {
      for (const row of filtered) {
        if (row.projectId === args.projectId) {
          const id = row._id
          boostedScores.set(id, (boostedScores.get(id) ?? 0) * PROJECT_CHUNK_BOOST)
        }
      }
    }
    const resorted = [...filtered].sort(
      (a, b) => (boostedScores.get(b._id) ?? 0) - (boostedScores.get(a._id) ?? 0),
    )

    const top = packChunksForContext(resorted, boostedScores, m)

    return { chunks: top }
  },
})
