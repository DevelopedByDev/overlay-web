import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { paginateArray } from './pagination-core'

type ListItem = Record<string, unknown>

export async function standardizePaginatedListResponse(
  request: NextRequest,
  response: Response,
): Promise<Response> {
  if (request.method !== 'GET' || !response.ok) return response
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) return response

  const payload = await response.clone().json().catch((_error) => undefined)
  if (!Array.isArray(payload)) return response

  const headers = new Headers(response.headers)
  headers.delete('content-length')
  headers.set('content-type', 'application/json')
  return NextResponse.json(paginateArray(payload as ListItem[], request.nextUrl.searchParams), {
    status: response.status,
    headers,
  })
}
