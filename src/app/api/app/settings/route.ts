import { NextRequest, NextResponse } from 'next/server'
import type { AppSettings, ThemePresetId } from '@overlay/app-core'
import { convex } from '@/lib/convex'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import { resolveAuthenticatedAppUser } from '@/lib/app-api-auth'
import { z } from '@/lib/api-schemas'

const AppSettingsRequestSchema = z.object({
  theme: z.enum(['light', 'dark']).optional(),
  lightThemePreset: z.string().optional(),
  darkThemePreset: z.string().optional(),
  useSecondarySidebar: z.boolean().optional(),
  chatStreamingMode: z.enum(['token', 'chunk']).optional(),
  accessToken: z.string().optional(),
  userId: z.string().optional(),
}).openapi('AppSettingsRequest')
const AppSettingsResponseSchema = z.unknown().openapi('AppSettingsResponse')
void AppSettingsRequestSchema
void AppSettingsResponseSchema


const VALID_PRESET_IDS = new Set<string>(['default-light', 'default-dark', 'codex', 'catppuccin'])

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
      lightThemePreset?: ThemePresetId
      darkThemePreset?: ThemePresetId
      useSecondarySidebar?: boolean
      /** @deprecated Only `token` is supported; `chunk` is accepted for compatibility and normalized away. */
      chatStreamingMode?: 'token' | 'chunk'
      accessToken?: string
      userId?: string
    }

    if (body.theme !== undefined && body.theme !== 'light' && body.theme !== 'dark') {
      return NextResponse.json({ error: 'Invalid theme' }, { status: 400 })
    }
    if (body.lightThemePreset !== undefined && !VALID_PRESET_IDS.has(body.lightThemePreset)) {
      return NextResponse.json({ error: 'Invalid lightThemePreset' }, { status: 400 })
    }
    if (body.darkThemePreset !== undefined && !VALID_PRESET_IDS.has(body.darkThemePreset)) {
      return NextResponse.json({ error: 'Invalid darkThemePreset' }, { status: 400 })
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
      lightThemePreset?: string
      darkThemePreset?: string
      useSecondarySidebar?: boolean
    } = {
      userId: auth.userId,
      serverSecret: getInternalApiSecret(),
    }

    if (body.theme !== undefined) {
      mutationArgs.theme = body.theme
    }
    if (body.lightThemePreset !== undefined) {
      mutationArgs.lightThemePreset = body.lightThemePreset
    }
    if (body.darkThemePreset !== undefined) {
      mutationArgs.darkThemePreset = body.darkThemePreset
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
