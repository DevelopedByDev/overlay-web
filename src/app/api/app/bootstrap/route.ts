import { NextRequest, NextResponse } from 'next/server'
import {
  CANONICAL_APP_DESTINATIONS,
  DEFAULT_APP_SETTINGS,
  type AppBootstrapResponse,
  type AppSettings,
  type Entitlements,
} from '@overlay/app-core'
import { getSession } from '@/lib/workos-auth'
import { convex } from '@/lib/convex'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import { resolveAuthenticatedAppUser } from '@/lib/app-api-auth'
import {
  AVAILABLE_MODELS,
  DEFAULT_MODEL_ID,
  DEFAULT_IMAGE_MODEL_ID,
  DEFAULT_VIDEO_MODEL_ID,
  IMAGE_MODELS,
  VIDEO_MODELS,
} from '@/lib/models'

export async function GET(request: NextRequest) {
  try {
    const auth = await resolveAuthenticatedAppUser(request, {})
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const serverSecret = getInternalApiSecret()
    const browserSession = await getSession()

    const [profile, entitlements, uiSettings] = await Promise.all([
      auth.accessToken
        ? convex.query<{
            profile?: {
              userId: string
              email: string
              firstName?: string
              lastName?: string
              profilePictureUrl?: string
            }
          } | null>('users:getUserProfile', {
            accessToken: auth.accessToken,
            userId: auth.userId,
          })
        : Promise.resolve(null),
      convex.query<Entitlements | null>('usage:getEntitlementsByServer', {
        userId: auth.userId,
        serverSecret,
      }),
      convex.query<AppSettings>(
        'uiSettings:getByServer',
        {
          userId: auth.userId,
          serverSecret,
        },
        { throwOnError: true },
      ).catch(() => DEFAULT_APP_SETTINGS),
    ])

    const response: AppBootstrapResponse = {
      user:
        browserSession?.user ??
        (profile?.profile
          ? {
              id: profile.profile.userId,
              email: profile.profile.email,
              firstName: profile.profile.firstName,
              lastName: profile.profile.lastName,
              profilePictureUrl: profile.profile.profilePictureUrl,
              emailVerified: false,
            }
          : null),
      entitlements,
      uiSettings: uiSettings ?? DEFAULT_APP_SETTINGS,
      chatModels: AVAILABLE_MODELS,
      imageModels: IMAGE_MODELS,
      videoModels: VIDEO_MODELS,
      featureFlags: {
        canUseVoiceTranscription: true,
        canUseKnowledge: true,
        canUseProjects: true,
        canUseExtensions: true,
      },
      destinations: [...CANONICAL_APP_DESTINATIONS],
      defaults: {
        chatModelId: DEFAULT_MODEL_ID,
        imageModelId: DEFAULT_IMAGE_MODEL_ID,
        videoModelId: DEFAULT_VIDEO_MODEL_ID,
      },
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('[app/bootstrap] GET error:', error)
    return NextResponse.json({ error: 'Failed to load app bootstrap' }, { status: 500 })
  }
}
