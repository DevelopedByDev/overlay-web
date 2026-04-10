import { NextRequest, NextResponse } from 'next/server'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import { resolveAuthenticatedAppUser } from '@/lib/app-api-auth'
import { getAppUiSettings, updateAppUiSettings } from '@/lib/app-api/settings-service'

export async function GET(request: NextRequest) {
  try {
    const auth = await resolveAuthenticatedAppUser(request, {})
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const settings = await getAppUiSettings(auth.userId, getInternalApiSecret())
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
      accessToken?: string
      userId?: string
    }

    if (body.theme !== undefined && body.theme !== 'light' && body.theme !== 'dark') {
      return NextResponse.json({ error: 'Invalid theme' }, { status: 400 })
    }

    const auth = await resolveAuthenticatedAppUser(request, body)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const settings = await updateAppUiSettings({
      userId: auth.userId,
      serverSecret: getInternalApiSecret(),
      ...(body.theme !== undefined ? { theme: body.theme } : {}),
      ...(body.useSecondarySidebar !== undefined
        ? { useSecondarySidebar: body.useSecondarySidebar }
        : {}),
    })
    return NextResponse.json(settings)
  } catch (error) {
    console.error('[app/settings] PATCH error:', error)
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
  }
}
