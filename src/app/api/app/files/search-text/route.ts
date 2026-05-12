import { NextRequest, NextResponse } from 'next/server'
import { convex } from '@/lib/convex'
import {
  DEFAULT_CONTEXT_CHARS,
  DEFAULT_MAX_MATCHES_PER_FILE,
  DEFAULT_MAX_TOTAL_SNIPPET_CHARS,
  MAX_FILE_IDS_PER_REQUEST,
  MAX_QUERY_CHARS,
  dedupeFileIdsPreserveOrder,
  findSubstringMatchesInText,
} from '@/lib/file-text-search'
import { resolveAuthenticatedAppUser } from '@/lib/app-api-auth'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import type { Id } from '../../../../../../convex/_generated/dataModel'
import { enforceRateLimits, getClientIp } from '@/lib/rate-limit'
import { z } from '@/lib/api-schemas'

const AppFilesSearchTextRequestSchema = z.object({
  fileIds: z.array(z.string()).default([]),
  query: z.string().optional(),
  contextChars: z.number().int().optional(),
  maxMatchesPerFile: z.number().int().optional(),
  maxTotalSnippetChars: z.number().int().optional(),
  accessToken: z.string().optional(),
  userId: z.string().optional(),
}).openapi('AppFilesSearchTextRequest')
const AppFilesSearchTextResponseSchema = z.unknown().openapi('AppFilesSearchTextResponse')
void AppFilesSearchTextRequestSchema
void AppFilesSearchTextResponseSchema


export const maxDuration = 60

function isBinaryProxyContent(content: string): boolean {
  return content.startsWith('/api/app/files/')
}

export type SearchTextMatchRow = {
  fileId: string
  fileName: string
  matchIndexInFile: number
  charStart: number
  charEnd: number
  snippet: string
}

type ConvexFileGetResult = {
  _id: string
  name: string
  content: string
  userId: string
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      fileIds?: string[]
      query?: string
      contextChars?: number
      maxMatchesPerFile?: number
      maxTotalSnippetChars?: number
      accessToken?: string
      userId?: string
    }

    const auth = await resolveAuthenticatedAppUser(request, body)
    const userId = auth?.userId ?? null
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const rateLimitResponse = await enforceRateLimits(request, [
      { bucket: 'files:search-text:ip', key: getClientIp(request), limit: 120, windowMs: 10 * 60_000 },
      { bucket: 'files:search-text:user', key: userId, limit: 60, windowMs: 10 * 60_000 },
    ])
    if (rateLimitResponse) return rateLimitResponse

    const rawIds = Array.isArray(body.fileIds) ? body.fileIds : []
    const fileIds = dedupeFileIdsPreserveOrder(rawIds.map((id) => String(id)))
    if (fileIds.length === 0) {
      return NextResponse.json({ error: 'fileIds is required' }, { status: 400 })
    }
    if (fileIds.length > MAX_FILE_IDS_PER_REQUEST) {
      return NextResponse.json(
        { error: `At most ${MAX_FILE_IDS_PER_REQUEST} file ids per request` },
        { status: 400 },
      )
    }

    const query = typeof body.query === 'string' ? body.query.trim() : ''
    if (!query) {
      return NextResponse.json({ error: 'query is required' }, { status: 400 })
    }
    if (query.length > MAX_QUERY_CHARS) {
      return NextResponse.json(
        { error: `query too long (max ${MAX_QUERY_CHARS} characters)` },
        { status: 400 },
      )
    }

    const contextChars =
      typeof body.contextChars === 'number' && body.contextChars >= 0 && body.contextChars <= 2000
        ? Math.floor(body.contextChars)
        : DEFAULT_CONTEXT_CHARS
    const maxMatchesPerFile =
      typeof body.maxMatchesPerFile === 'number' &&
      body.maxMatchesPerFile >= 1 &&
      body.maxMatchesPerFile <= 200
        ? Math.floor(body.maxMatchesPerFile)
        : DEFAULT_MAX_MATCHES_PER_FILE
    const maxTotalSnippetChars =
      typeof body.maxTotalSnippetChars === 'number' &&
      body.maxTotalSnippetChars >= 1000 &&
      body.maxTotalSnippetChars <= 500_000
        ? Math.floor(body.maxTotalSnippetChars)
        : DEFAULT_MAX_TOTAL_SNIPPET_CHARS

    const serverSecret = getInternalApiSecret()
    const matches: SearchTextMatchRow[] = []
    let truncated = false

    let remainingSnippetBudget = maxTotalSnippetChars

    for (const fileId of fileIds) {
      if (remainingSnippetBudget <= 0) {
        truncated = true
        break
      }
      const fileRow: ConvexFileGetResult | null = await convex.query<ConvexFileGetResult>('files:get', {
        fileId: fileId as Id<'files'>,
        userId,
        serverSecret,
        accessToken: auth?.accessToken,
      })

      if (!fileRow || fileRow.userId !== userId) {
        return NextResponse.json(
          { error: 'Invalid or inaccessible file id', fileId },
          { status: 403 },
        )
      }

      const content = fileRow.content ?? ''
      if (!content.trim() || isBinaryProxyContent(content)) {
        continue
      }

      const { matches: found, truncated: fileTrunc, snippetCharsUsed } = findSubstringMatchesInText({
        fullText: content,
        query,
        contextChars,
        maxMatches: maxMatchesPerFile,
        maxTotalSnippetChars: remainingSnippetBudget,
      })

      remainingSnippetBudget -= snippetCharsUsed
      if (fileTrunc) truncated = true
      if (remainingSnippetBudget <= 0 && found.length > 0) truncated = true

      found.forEach((m, i) => {
        matches.push({
          fileId,
          fileName: fileRow.name,
          matchIndexInFile: i,
          charStart: m.charStart,
          charEnd: m.charEnd,
          snippet: m.snippet,
        })
      })

      if (remainingSnippetBudget <= 0) break
    }

    return NextResponse.json({
      success: true as const,
      matches,
      truncated,
    })
  } catch (e) {
    console.error('[files/search-text]', e)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}
