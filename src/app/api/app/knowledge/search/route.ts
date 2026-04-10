import { NextRequest, NextResponse } from 'next/server'
import { resolveAuthenticatedAppUser } from '@/lib/app-api-auth'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import { searchAppKnowledge } from '@/lib/app-api/knowledge-service'

export const maxDuration = 60

function isTrustedInternalToolRequest(
  request: NextRequest,
  body: { userId?: string },
): boolean {
  const h = request.headers.get('x-internal-api-secret')?.trim()
  const expected = getInternalApiSecret()
  return Boolean(
    h &&
      h === expected &&
      typeof body.userId === 'string' &&
      body.userId.trim().length > 0,
  )
}

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
    const userId =
      auth?.userId ??
      (isTrustedInternalToolRequest(request, body) ? body.userId!.trim() : null)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const query = body.query?.trim()
    if (!query) {
      return NextResponse.json({ error: 'query is required' }, { status: 400 })
    }

    const serverSecret = getInternalApiSecret()
    const result = await searchAppKnowledge({
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
