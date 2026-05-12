import { NextRequest, NextResponse } from 'next/server'
import { convex } from '@/lib/convex'
import { resolveAuthenticatedAppUser } from '@/lib/app-api-auth'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import type { HybridSearchChunk } from '../../../../../../convex/knowledge'
import { enforceRateLimits, getClientIp } from '@/lib/rate-limit'

import { z } from '@/lib/api-schemas'

const AppKnowledgeSearchRequestSchema = z.object({ query: z.string().optional(), projectId: z.string().optional(), sourceKind: z.enum(['file', 'memory']).optional(), kVec: z.number().optional(), kLex: z.number().optional(), m: z.number().optional(), accessToken: z.string().optional(), userId: z.string().optional() }).openapi('AppKnowledgeSearchRequest')
const AppKnowledgeSearchResponseSchema = z.unknown().openapi('AppKnowledgeSearchResponse')
void AppKnowledgeSearchRequestSchema
void AppKnowledgeSearchResponseSchema

export const maxDuration = 60
const MAX_QUERY_CHARS = 500

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      query?: string
      projectId?: string
      sourceKind?: 'file' | 'memory'
      kVec?: number
      kLex?: number
      m?: number
      accessToken?: string
      userId?: string
    }

    const auth = await resolveAuthenticatedAppUser(request, body)
    const userId = auth?.userId ?? null
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const rateLimitResponse = await enforceRateLimits(request, [
      { bucket: 'knowledge:search:ip', key: getClientIp(request), limit: 120, windowMs: 10 * 60_000 },
      { bucket: 'knowledge:search:user', key: userId, limit: 60, windowMs: 10 * 60_000 },
    ])
    if (rateLimitResponse) return rateLimitResponse

    const query = body.query?.trim()
    if (!query) {
      return NextResponse.json({ error: 'query is required' }, { status: 400 })
    }
    if (query.length > MAX_QUERY_CHARS) {
      return NextResponse.json({ error: `query cannot exceed ${MAX_QUERY_CHARS} characters` }, { status: 400 })
    }

    const serverSecret = getInternalApiSecret()
    const result = await convex.action<{ chunks: HybridSearchChunk[] }>('knowledge:hybridSearch', {
      accessToken: auth?.accessToken,
      userId,
      serverSecret,
      query,
      projectId: body.projectId,
      sourceKind: body.sourceKind,
      kVec: body.kVec,
      kLex: body.kLex,
      m: body.m,
    })

    if (!result) {
      return NextResponse.json({ error: 'Search failed' }, { status: 502 })
    }

    return NextResponse.json(result)
  } catch (e) {
    console.error('[knowledge/search]', e)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}
