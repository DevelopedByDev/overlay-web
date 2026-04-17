import { NextRequest, NextResponse } from 'next/server'
import { convex } from '@/lib/convex'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import { resolveAuthenticatedAppUser } from '@/lib/app-api-auth'

type UiSettings = {
  theme: 'light' | 'dark'
  useSecondarySidebar: boolean
  chatStreamingMode: 'token' | 'chunk'
}

export async function GET(request: NextRequest) {
  try {
    const auth = await resolveAuthenticatedAppUser(request, {})
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const settings = await convex.query<UiSettings>(
      'uiSettings:getByServer',
      {
        userId: auth.userId,
        serverSecret: getInternalApiSecret(),
      },
      { throwOnError: true },
    )
    return NextResponse.json(settings)
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
      chatStreamingMode?: 'token' | 'chunk'
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
    if (body.chatStreamingMode !== undefined) {
      mutationArgs.chatStreamingMode = body.chatStreamingMode
    }

    const settings = await convex.mutation<UiSettings>(
      'uiSettings:upsertByServer',
      mutationArgs,
      { throwOnError: true },
    )
    return NextResponse.json(settings)
  } catch (error) {
    console.error('[app/settings] PATCH error:', error)
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
  }
}
