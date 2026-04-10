import { NextRequest, NextResponse } from 'next/server'
import { R2GlobalBudgetError } from '@/lib/r2-budget'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import { resolveAuthenticatedAppUser } from '@/lib/app-api-auth'
import { createAppFileUploadUrl } from '@/lib/app-api/file-service'

export async function GET(request: NextRequest) {
  try {
    const auth = await resolveAuthenticatedAppUser(request, {})
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = request.nextUrl
    const name = searchParams.get('name')
    const mimeType = searchParams.get('mimeType') ?? 'application/octet-stream'
    const sizeBytesRaw = searchParams.get('sizeBytes')

    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })
    if (!sizeBytesRaw || isNaN(Number(sizeBytesRaw))) {
      return NextResponse.json({ error: 'sizeBytes required' }, { status: 400 })
    }

    const result = await createAppFileUploadUrl({
      userId: auth.userId,
      serverSecret: getInternalApiSecret(),
      sizeBytes: Number(sizeBytesRaw),
      name,
      mimeType,
    })

    console.log(
      `[FilesPresign] Generated PUT URL for userId=${auth.userId} key=${result.r2Key} size=${sizeBytesRaw}B`,
    )

    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof R2GlobalBudgetError) {
      return NextResponse.json(
        { error: 'storage_limit_exceeded', message: 'Global R2 storage cap reached. Contact support.' },
        { status: 403 },
      )
    }
    const message = err instanceof Error ? err.message : 'Failed to generate upload URL'
    if (message === 'Could not verify subscription.') {
      return NextResponse.json({ error: message }, { status: 401 })
    }
    if (message.includes('storage_limit_exceeded')) {
      return NextResponse.json(
        { error: 'storage_limit_exceeded', message: 'Not enough Overlay storage remaining.' },
        { status: 403 },
      )
    }
    console.error('[FilesPresign] Error:', err)
    return NextResponse.json({ error: 'Failed to generate upload URL' }, { status: 500 })
  }
}
