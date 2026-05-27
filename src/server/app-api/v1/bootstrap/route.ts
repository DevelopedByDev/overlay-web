import { validateApiBoundary } from '../_utils/boundary'
import { NextRequest, NextResponse } from 'next/server'
import {
  DEFAULT_APP_SETTINGS,
  overlayNavigationToDestinations,
  resolveOverlayAppShellConfig,
  type AppBootstrapResponse,
  type AppSettings,
  type Entitlements,
} from '@overlay/app-core'
import overlayAppConfig from '@/overlay.config'
import { getOverlaySession } from '@/server/auth/session'
import { convex } from '@/server/database/convex'
import { getInternalApiSecret } from '@/server/tools/internal-api-secret'
import { resolveAuthenticatedAppUser } from '@/server/auth/app-api-auth'
import {
  DEFAULT_MODEL_ID,
  DEFAULT_IMAGE_MODEL_ID,
  DEFAULT_VIDEO_MODEL_ID,
} from '@/shared/ai/gateway/model-types'
import {
  AVAILABLE_MODELS,
  IMAGE_MODELS,
  VIDEO_MODELS,
} from '@/shared/ai/gateway/model-data'
import {
  formatOverlayConfigError,
  getOverlayRuntimeConfig,
  getRedactedOverlayRuntimeConfigSummary,
} from '@/server/config'
import { isRuntimeConfigSummaryVisible } from '@/shared/config'
import { getOverlayCapabilities } from '@/server/capabilities'

export async function GET(request: NextRequest) {
  const boundaryError = await validateApiBoundary(request)
  if (boundaryError) return boundaryError
  let runtimeConfig
  try {
    runtimeConfig = await getOverlayRuntimeConfig()
  } catch (error) {
    const formatted = formatOverlayConfigError(error)
    return NextResponse.json(
      {
        error: 'Runtime configuration is invalid',
        issues: formatted.issues,
      },
      { status: 500 },
    )
  }

  try {
    const auth = await resolveAuthenticatedAppUser(request, {})
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const serverSecret = getInternalApiSecret()
    const browserSession = await getOverlaySession()

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
          } | null>('auth/users:getUserProfile', {
            accessToken: auth.accessToken,
            userId: auth.userId,
          })
        : Promise.resolve(null),
      convex.query<Entitlements | null>('platform/usage:getEntitlementsByServer', {
        userId: auth.userId,
        serverSecret,
      }),
      convex.query<AppSettings>(
        'platform/uiSettings:getByServer',
        {
          userId: auth.userId,
          serverSecret,
        },
        { throwOnError: true },
      ).catch(() => DEFAULT_APP_SETTINGS),
    ])

    const user =
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
        : null)
    const modelPolicyContext = { user, entitlements }
    const chatModels = [
      ...(overlayAppConfig.modelPolicy?.filterChatModels?.(AVAILABLE_MODELS, modelPolicyContext) ??
        AVAILABLE_MODELS),
    ]
    const imageModels = [
      ...(overlayAppConfig.modelPolicy?.filterImageModels?.(IMAGE_MODELS, modelPolicyContext) ??
        IMAGE_MODELS),
    ]
    const videoModels = [
      ...(overlayAppConfig.modelPolicy?.filterVideoModels?.(VIDEO_MODELS, modelPolicyContext) ??
        VIDEO_MODELS),
    ]
    const capabilities = await getOverlayCapabilities()
    const appShell = resolveOverlayAppShellConfig(overlayAppConfig, { capabilities })

    const response: AppBootstrapResponse & {
      system?: ReturnType<typeof getRedactedOverlayRuntimeConfigSummary>
    } = {
      user,
      entitlements,
      uiSettings: uiSettings ?? DEFAULT_APP_SETTINGS,
      chatModels,
      imageModels,
      videoModels,
      brand: appShell.brand,
      navigation: [...appShell.navigation],
      settingsSections: [...appShell.settingsSections],
      featureFlagRegistry: [...appShell.featureFlags],
      featureModules: [...appShell.featureModules],
      sidebarActions: [...appShell.sidebarActions],
      settingsPanels: [...appShell.settingsPanels],
      toolRegistry: [...appShell.tools],
      integrationRegistry: [...appShell.integrations],
      modelProviderRegistry: [...appShell.modelProviders],
      policyGates: [...appShell.policyGates],
      theme: appShell.theme,
      featureFlags: appShell.appFeatureFlags,
      capabilities,
      destinations: overlayNavigationToDestinations(appShell.navigation, appShell.settingsSections),
      defaults: {
        chatModelId:
          overlayAppConfig.modelPolicy?.getDefaultChatModelId?.(chatModels, modelPolicyContext) ??
          DEFAULT_MODEL_ID,
        imageModelId:
          overlayAppConfig.modelPolicy?.getDefaultImageModelId?.(imageModels, modelPolicyContext) ??
          DEFAULT_IMAGE_MODEL_ID,
        videoModelId:
          overlayAppConfig.modelPolicy?.getDefaultVideoModelId?.(videoModels, modelPolicyContext) ??
          DEFAULT_VIDEO_MODEL_ID,
      },
    }

    if (isRuntimeConfigSummaryVisible(runtimeConfig)) {
      response.system = getRedactedOverlayRuntimeConfigSummary(runtimeConfig)
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('[app/bootstrap] GET error:', error)
    return NextResponse.json({ error: 'Failed to load app bootstrap' }, { status: 500 })
  }
}
