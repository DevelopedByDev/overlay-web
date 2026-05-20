import { NextRequest, NextResponse } from 'next/server'
import { getApiBoundarySchema, queryParamsToObject } from '@/shared/schemas/api-boundary'

function validationError(issues: unknown): NextResponse {
  return NextResponse.json(
    {
      error: 'Invalid request',
      issues,
    },
    { status: 400 },
  )
}

async function readJsonBody(request: NextRequest): Promise<unknown> {
  const text = await request.clone().text()
  if (!text.trim()) return {}
  return JSON.parse(text)
}

export async function validateApiBoundary(request: NextRequest): Promise<NextResponse | null> {
  const schema = getApiBoundarySchema(request.nextUrl.pathname, request.method)
  if (!schema) return null

  if (schema.query) {
    const result = schema.query.safeParse(queryParamsToObject(request.nextUrl.searchParams))
    if (!result.success) return validationError(result.error.issues)
  }

  if (schema.formData) {
    const result = schema.formData.safeParse(await request.clone().formData().catch(() => undefined))
    if (!result.success) return validationError(result.error.issues)
    return null
  }

  if (schema.json && request.method !== 'GET' && request.method !== 'HEAD') {
    const result = schema.json.safeParse(await readJsonBody(request).catch(() => undefined))
    if (!result.success) return validationError(result.error.issues)
  }

  return null
}
