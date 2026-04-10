import { NextRequest, NextResponse } from 'next/server'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import { R2GlobalBudgetError } from '@/lib/r2-budget'
import { resolveAuthenticatedAppUser } from '@/lib/app-api-auth'
import { createAppFileUploadUrl } from '@/lib/app-api/file-service'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({})) as {
      sizeBytes?: number
      name?: string
      mimeType?: string
      accessToken?: string
      userId?: string
    }
    const auth = await resolveAuthenticatedAppUser(request, body)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const result = await createAppFileUploadUrl({
      userId: auth.userId,
      serverSecret: getInternalApiSecret(),
      sizeBytes: body.sizeBytes ?? 0,
      name: body.name,
      mimeType: body.mimeType,
    })
    return NextResponse.json({ uploadUrl: result.presignedUrl, r2Key: result.r2Key })
  } catch (error) {
    if (error instanceof R2GlobalBudgetError) {
      return NextResponse.json({ error: 'Overlay storage limit reached.' }, { status: 403 })
    }
    const message = error instanceof Error ? error.message : 'Failed to generate upload URL'
    if (message === 'sizeBytes is required') {
      return NextResponse.json({ error: message }, { status: 400 })
    }
    if (message === 'Could not verify subscription.') {
      return NextResponse.json({ error: message }, { status: 401 })
    }
    if (message.includes('storage_limit_exceeded')) {
      return NextResponse.json({ error: 'Overlay storage limit reached.' }, { status: 403 })
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
