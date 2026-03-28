import { NextRequest, NextResponse } from 'next/server'
import { convex } from '@/lib/convex'
import { getComputerServerSecret, requireComputerApiContext } from '@/lib/computer-api-route'

type ComputerRecord = {
  _id: string
  name: string
  status: string
  region: string
  provisioningStep?: string | null
  updateChannel?: string
  desiredReleaseVersion?: string
  appliedReleaseVersion?: string | null
  previousReleaseVersion?: string | null
  updateStatus?: string
  reprovisionRequired?: boolean
  lastUpdateCheckAt?: number | null
  lastUpdateStartedAt?: number | null
  lastUpdateCompletedAt?: number | null
  lastUpdateError?: string | null
  desiredOverlayPluginVersion?: string | null
  overlayPluginInstalledVersion?: string | null
  overlayPluginHealthStatus?: string | null
  overlayPluginLastHealthCheckAt?: number | null
  overlayPluginLastError?: string | null
}

type ComputerReleaseContext = {
  update?: unknown
  desiredRelease?: unknown
  latestRelease?: unknown
}

export async function GET(request: NextRequest) {
  const auth = await requireComputerApiContext(request)
  if (auth instanceof NextResponse) return auth

  try {
    const serverSecret = getComputerServerSecret()
    const [computer, release] = await Promise.all([
      convex.query<ComputerRecord | null>('computers:get', {
        computerId: auth.computerId,
        userId: auth.userId,
        serverSecret,
      }),
      convex.query<ComputerReleaseContext>('computers:getResolvedComputerRelease', {
        computerId: auth.computerId,
        userId: auth.userId,
        serverSecret,
      }),
    ])

    return NextResponse.json({
      computer,
      update: release?.update ?? null,
      desiredRelease: release?.desiredRelease ?? null,
      latestRelease: release?.latestRelease ?? null,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch update context'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
