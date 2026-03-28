import { NextRequest, NextResponse } from 'next/server'
import { requireComputerApiContext } from '@/lib/computer-api-route'
import {
  OPENCLAW_OVERLAY_PLUGIN_FILES,
  OPENCLAW_OVERLAY_PLUGIN_ID,
  OPENCLAW_OVERLAY_PLUGIN_PACKAGE_NAME,
  OPENCLAW_OVERLAY_PLUGIN_VERSION,
} from '@/lib/openclaw-overlay-plugin-bundle'

export async function GET(request: NextRequest) {
  const auth = await requireComputerApiContext(request)
  if (auth instanceof NextResponse) return auth

  const requestedVersion = request.nextUrl.searchParams.get('version')?.trim()
  if (requestedVersion && requestedVersion !== OPENCLAW_OVERLAY_PLUGIN_VERSION) {
    return NextResponse.json(
      {
        error: `Overlay plugin version ${requestedVersion} is not available on this deployment.`,
        availableVersion: OPENCLAW_OVERLAY_PLUGIN_VERSION,
      },
      { status: 409 },
    )
  }

  return NextResponse.json({
    pluginId: OPENCLAW_OVERLAY_PLUGIN_ID,
    packageName: OPENCLAW_OVERLAY_PLUGIN_PACKAGE_NAME,
    version: OPENCLAW_OVERLAY_PLUGIN_VERSION,
    files: OPENCLAW_OVERLAY_PLUGIN_FILES,
    tokenVersion: auth.tokenVersion,
  })
}
