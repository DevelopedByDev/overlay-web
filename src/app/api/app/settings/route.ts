import { NextRequest, NextResponse } from 'next/server'
import type { AppSettings, ChatModePreference, ThemePresetId } from '@overlay/app-core'
import { convex } from '@/lib/convex'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import { resolveAuthenticatedAppUser } from '@/lib/app-api-auth'
import { isThemePresetId } from '@/lib/themes'

const MAX_MODEL_ID_LENGTH = 160
const MAX_ASK_MODEL_IDS = 4
const MODEL_ID_PATTERN = /^[A-Za-z0-9._~:/@+-]+$/
const ASPECT_RATIO_PATTERN = /^\d{1,2}:\d{1,2}$/

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isSafeModelId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= MAX_MODEL_ID_LENGTH &&
    MODEL_ID_PATTERN.test(value)
  )
}

function isSafeAspectRatio(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 5 && ASPECT_RATIO_PATTERN.test(value)
}

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
    const rawBody = await request.json().catch(() => null)
    if (!isPlainObject(rawBody)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }
    const body = rawBody as {
      theme?: 'light' | 'dark'
      lightThemePreset?: ThemePresetId
      darkThemePreset?: ThemePresetId
      useSecondarySidebar?: boolean
      autoContinue?: boolean
      defaultChatMode?: ChatModePreference
      defaultAskModelIds?: string[]
      defaultActModelId?: string
      defaultImageModelId?: string
      defaultVideoModelId?: string
      defaultImageAspectRatio?: string
      defaultVideoAspectRatio?: string
      sendWithEnter?: boolean
      attachFilesToKnowledgeByDefault?: boolean
      onlyAllowZdrModels?: boolean
      dismissedZdrWarningGlobally?: boolean
      dismissedZdrWarningModelIds?: string[]
      /** @deprecated Only `token` is supported; `chunk` is accepted for compatibility and normalized away. */
      chatStreamingMode?: 'token' | 'chunk'
      accessToken?: string
      userId?: string
    }

    if (body.theme !== undefined && body.theme !== 'light' && body.theme !== 'dark') {
      return NextResponse.json({ error: 'Invalid theme' }, { status: 400 })
    }
    if (body.lightThemePreset !== undefined && !isThemePresetId(body.lightThemePreset)) {
      return NextResponse.json({ error: 'Invalid lightThemePreset' }, { status: 400 })
    }
    if (body.darkThemePreset !== undefined && !isThemePresetId(body.darkThemePreset)) {
      return NextResponse.json({ error: 'Invalid darkThemePreset' }, { status: 400 })
    }
    if (body.useSecondarySidebar !== undefined && typeof body.useSecondarySidebar !== 'boolean') {
      return NextResponse.json({ error: 'Invalid useSecondarySidebar' }, { status: 400 })
    }
    if (body.autoContinue !== undefined && typeof body.autoContinue !== 'boolean') {
      return NextResponse.json({ error: 'Invalid autoContinue' }, { status: 400 })
    }
    if (
      body.defaultChatMode !== undefined &&
      body.defaultChatMode !== 'ask' &&
      body.defaultChatMode !== 'act'
    ) {
      return NextResponse.json({ error: 'Invalid defaultChatMode' }, { status: 400 })
    }
    if (
      body.defaultAskModelIds !== undefined &&
      (!Array.isArray(body.defaultAskModelIds) ||
        body.defaultAskModelIds.length > MAX_ASK_MODEL_IDS ||
        !body.defaultAskModelIds.every(isSafeModelId))
    ) {
      return NextResponse.json({ error: 'Invalid defaultAskModelIds' }, { status: 400 })
    }
    for (const key of [
      'defaultActModelId',
      'defaultImageModelId',
      'defaultVideoModelId',
    ] as const) {
      if (body[key] !== undefined && !isSafeModelId(body[key])) {
        return NextResponse.json({ error: `Invalid ${key}` }, { status: 400 })
      }
    }
    for (const key of ['defaultImageAspectRatio', 'defaultVideoAspectRatio'] as const) {
      if (body[key] !== undefined && !isSafeAspectRatio(body[key])) {
        return NextResponse.json({ error: `Invalid ${key}` }, { status: 400 })
      }
    }
    if (body.sendWithEnter !== undefined && typeof body.sendWithEnter !== 'boolean') {
      return NextResponse.json({ error: 'Invalid sendWithEnter' }, { status: 400 })
    }
    if (
      body.attachFilesToKnowledgeByDefault !== undefined &&
      typeof body.attachFilesToKnowledgeByDefault !== 'boolean'
    ) {
      return NextResponse.json({ error: 'Invalid attachFilesToKnowledgeByDefault' }, { status: 400 })
    }
    if (body.onlyAllowZdrModels !== undefined && typeof body.onlyAllowZdrModels !== 'boolean') {
      return NextResponse.json({ error: 'Invalid onlyAllowZdrModels' }, { status: 400 })
    }
    if (
      body.dismissedZdrWarningGlobally !== undefined &&
      typeof body.dismissedZdrWarningGlobally !== 'boolean'
    ) {
      return NextResponse.json({ error: 'Invalid dismissedZdrWarningGlobally' }, { status: 400 })
    }
    if (
      body.dismissedZdrWarningModelIds !== undefined &&
      (!Array.isArray(body.dismissedZdrWarningModelIds) ||
        body.dismissedZdrWarningModelIds.length > 100 ||
        !body.dismissedZdrWarningModelIds.every(isSafeModelId))
    ) {
      return NextResponse.json({ error: 'Invalid dismissedZdrWarningModelIds' }, { status: 400 })
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
      autoContinue?: boolean
      defaultChatMode?: ChatModePreference
      defaultAskModelIds?: string[]
      defaultActModelId?: string
      defaultImageModelId?: string
      defaultVideoModelId?: string
      defaultImageAspectRatio?: string
      defaultVideoAspectRatio?: string
      sendWithEnter?: boolean
      attachFilesToKnowledgeByDefault?: boolean
      onlyAllowZdrModels?: boolean
      dismissedZdrWarningGlobally?: boolean
      dismissedZdrWarningModelIds?: string[]
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
    if (body.autoContinue !== undefined) {
      mutationArgs.autoContinue = body.autoContinue
    }
    if (body.defaultChatMode !== undefined) {
      mutationArgs.defaultChatMode = body.defaultChatMode
    }
    if (body.defaultAskModelIds !== undefined) {
      mutationArgs.defaultAskModelIds = body.defaultAskModelIds.map((id) => id.trim())
    }
    if (body.defaultActModelId !== undefined) {
      mutationArgs.defaultActModelId = body.defaultActModelId.trim()
    }
    if (body.defaultImageModelId !== undefined) {
      mutationArgs.defaultImageModelId = body.defaultImageModelId.trim()
    }
    if (body.defaultVideoModelId !== undefined) {
      mutationArgs.defaultVideoModelId = body.defaultVideoModelId.trim()
    }
    if (body.defaultImageAspectRatio !== undefined) {
      mutationArgs.defaultImageAspectRatio = body.defaultImageAspectRatio.trim()
    }
    if (body.defaultVideoAspectRatio !== undefined) {
      mutationArgs.defaultVideoAspectRatio = body.defaultVideoAspectRatio.trim()
    }
    if (body.sendWithEnter !== undefined) {
      mutationArgs.sendWithEnter = body.sendWithEnter
    }
    if (body.attachFilesToKnowledgeByDefault !== undefined) {
      mutationArgs.attachFilesToKnowledgeByDefault = body.attachFilesToKnowledgeByDefault
    }
    if (body.onlyAllowZdrModels !== undefined) {
      mutationArgs.onlyAllowZdrModels = body.onlyAllowZdrModels
    }
    if (body.dismissedZdrWarningGlobally !== undefined) {
      mutationArgs.dismissedZdrWarningGlobally = body.dismissedZdrWarningGlobally
    }
    if (body.dismissedZdrWarningModelIds !== undefined) {
      mutationArgs.dismissedZdrWarningModelIds = Array.from(new Set(body.dismissedZdrWarningModelIds.map((id) => id.trim()))).slice(0, 100)
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
