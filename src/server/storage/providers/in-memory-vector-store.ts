import 'server-only'

import type { QueryResult, VectorStore } from '@overlay/app-core'

type VectorRecord = {
  vector: number[]
  metadata: Record<string, unknown>
}

function cosineSimilarity(left: number[], right: number[]): number {
  const length = Math.min(left.length, right.length)
  let dot = 0
  let leftNorm = 0
  let rightNorm = 0

  for (let index = 0; index < length; index += 1) {
    const l = left[index] ?? 0
    const r = right[index] ?? 0
    dot += l * r
    leftNorm += l * l
    rightNorm += r * r
  }

  if (leftNorm === 0 || rightNorm === 0) return 0
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm))
}

function matchesFilter(
  metadata: Record<string, unknown>,
  filter: Record<string, unknown> | undefined,
): boolean {
  if (!filter) return true
  return Object.entries(filter).every(([key, value]) => metadata[key] === value)
}

export class InMemoryVectorStore implements VectorStore {
  private readonly records = new Map<string, VectorRecord>()

  async upsert(args: {
    id: string
    vector: number[]
    metadata: Record<string, unknown>
  }): Promise<void> {
    this.records.set(args.id, {
      vector: [...args.vector],
      metadata: { ...args.metadata },
    })
  }

  async query(args: {
    vector: number[]
    topK: number
    filter?: Record<string, unknown>
  }): Promise<QueryResult[]> {
    return [...this.records.entries()]
      .filter(([, record]) => matchesFilter(record.metadata, args.filter))
      .map(([id, record]) => ({
        id,
        score: cosineSimilarity(args.vector, record.vector),
        metadata: record.metadata,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.max(0, args.topK))
  }

  async delete(id: string): Promise<void> {
    this.records.delete(id)
  }
}
