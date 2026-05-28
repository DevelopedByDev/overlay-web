import { NextRequest } from 'next/server'
import type { AppApiRouteContext } from '@/server/app-api/bff-context'
import { fileService } from '@/server/files/http'

export const runtime = 'nodejs'

export async function GET(
  request: NextRequest,
  context: AppApiRouteContext,
) {
  void request
  const { auth } = context
  const { fileId } = await context.params as { fileId: string }
  const result = await fileService.getContentProxy({
    fileId,
    userId: auth.userId,
  })

  if (result.kind === 'json') {
    return Response.json(result.payload, { status: result.status })
  }
  if (result.kind === 'redirect') {
    return Response.redirect(result.url, 302)
  }

  const upstream = await fetch(result.url)
  if (!upstream.ok || !upstream.body) {
    return Response.json({ error: 'Failed to load stored asset.' }, { status: 502 })
  }
  const headers = new Headers()
  const ct = upstream.headers.get('content-type')
  if (ct) headers.set('content-type', ct)
  const cd = upstream.headers.get('content-disposition')
  if (cd) headers.set('content-disposition', cd)
  return new Response(upstream.body, { status: 200, headers })
}
