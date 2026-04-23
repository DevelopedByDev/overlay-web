import { NextRequest, NextResponse } from 'next/server'
import type { AppSettings } from '@overlay/app-core'
import { convex } from '@/lib/convex'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import { resolveAuthenticatedAppUser } from '@/lib/app-api-auth'

export async function GET(request: NextRequest) {
  try {
    const auth = await resolveAuthenticatedAppUser(request, {})
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const settings = await convex.query<AppSettings>(
      'uiSettings:getByServer',
      {
        userId: auth.userId,
        serverSecret: getInternalApiSecret(),
      },
      { throwOnError: true },
    )
    return NextResponse.json({ ...settings, chatStreamingMode: 'token' as const })
  } catch (error) {
    console.error('[app/settings] GET error:', error)
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      theme?: 'light' | 'dark'
      useSecondarySidebar?: boolean
      /** @deprecated Only `token` is supported; `chunk` is accepted for compatibility and normalized away. */
      chatStreamingMode?: 'token' | 'chunk'
      accessToken?: string
      userId?: string
    }

    if (body.theme !== undefined && body.theme !== 'light' && body.theme !== 'dark') {
      return NextResponse.json({ error: 'Invalid theme' }, { status: 400 })
    }
    if (
      body.chatStreamingMode !== undefined &&
      body.chatStreamingMode !== 'token' &&
      body.chatStreamingMode !== 'chunk'
    ) {
      return NextResponse.json({ error: 'Invalid chatStreamingMode' }, { status: 400 })
    }

    const auth = await resolveAuthenticatedAppUser(request, body)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const mutationArgs: {
      userId: string
      serverSecret: string
      theme?: 'light' | 'dark'
      useSecondarySidebar?: boolean
    } = {
      userId: auth.userId,
      serverSecret: getInternalApiSecret(),
    }

    if (body.theme !== undefined) {
      mutationArgs.theme = body.theme
    }
    if (body.useSecondarySidebar !== undefined) {
      mutationArgs.useSecondarySidebar = body.useSecondarySidebar
    }

    const settings = await convex.mutation<AppSettings>(
      'uiSettings:upsertByServer',
      mutationArgs,
      { throwOnError: true },
    )
    return NextResponse.json({ ...settings, chatStreamingMode: 'token' as const })
  } catch (error) {
    console.error('[app/settings] PATCH error:', error)
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
  }
}
