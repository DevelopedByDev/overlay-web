import { NextResponse } from 'next/server'
import {
  overlayNavigationToDestinations,
  resolveOverlayAppShellConfig,
} from '@overlay/app-core'
import overlayAppConfig from '@/overlay.config'
import {
  getOverlayCapabilities,
  runtimeConfigErrorResponse,
} from '@/server/capabilities'

export async function GET() {
  try {
    const capabilities = await getOverlayCapabilities()
    const appShell = resolveOverlayAppShellConfig(overlayAppConfig, { capabilities })

    return NextResponse.json({
      capabilities,
      featureFlags: appShell.appFeatureFlags,
      navigation: appShell.navigation,
      settingsSections: appShell.settingsSections,
      sidebarActions: appShell.sidebarActions,
      destinations: overlayNavigationToDestinations(appShell.navigation, appShell.settingsSections),
    })
  } catch (error) {
    return runtimeConfigErrorResponse(error)
  }
}
