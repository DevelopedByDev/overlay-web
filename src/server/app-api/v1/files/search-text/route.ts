import { NextRequest, NextResponse } from 'next/server'
import type { AppApiRouteContext } from '@/server/app-api/bff-context'
import { fileErrorResponse, fileService } from '@/server/files/http'

export const maxDuration = 60

export async function POST(request: NextRequest, context: AppApiRouteContext) {
  try {
    const body = (await request.json()) as Record<string, unknown>
    const { auth } = context
    const result = await fileService.searchText({
      userId: auth.userId,
      accessToken: auth.accessToken,
      body,
    })
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof Error && error.name === 'FileServiceError') {
      return fileErrorResponse(error, 'Search failed')
    }
    console.error('[files/search-text]', error)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}
