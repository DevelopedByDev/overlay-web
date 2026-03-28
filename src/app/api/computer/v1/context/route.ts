import { NextRequest, NextResponse } from 'next/server'
import { convex } from '@/lib/convex'
import { COMPUTER_RESOURCE_CAPABILITIES } from '@/lib/computer-capabilities'
import { getComputerServerSecret, requireComputerApiContext } from '@/lib/computer-api-route'

type ComputerRecord = {
  _id: string
  name: string
  status: string
  region: string
  provisioningStep?: string | null
  updateChannel?: string
  desiredReleaseVersion?: string
  desiredOverlayPluginVersion?: string
  appliedReleaseVersion?: string | null
  previousReleaseVersion?: string | null
  updateStatus?: string
  reprovisionRequired?: boolean
  lastUpdateCheckAt?: number | null
  lastUpdateStartedAt?: number | null
  lastUpdateCompletedAt?: number | null
  lastUpdateError?: string | null
  overlayPluginInstalledVersion?: string | null
  overlayPluginHealthStatus?: 'unknown' | 'installing' | 'installed' | 'missing' | 'error' | null
  overlayPluginLastHealthCheckAt?: number | null
  overlayPluginLastError?: string | null
}

export async function GET(request: NextRequest) {
  const auth = await requireComputerApiContext(request)
  if (auth instanceof NextResponse) return auth

  try {
    const computer = await convex.query<ComputerRecord | null>('computers:get', {
      computerId: auth.computerId,
      userId: auth.userId,
      serverSecret: getComputerServerSecret(),
    })

    return NextResponse.json({
      computer: computer
        ? {
            _id: computer._id,
            name: computer.name,
            status: computer.status,
            region: computer.region,
            provisioningStep: computer.provisioningStep ?? null,
            update: {
              updateChannel: computer.updateChannel ?? 'stable',
              desiredReleaseVersion: computer.desiredReleaseVersion ?? null,
              desiredOverlayPluginVersion: computer.desiredOverlayPluginVersion ?? null,
              appliedReleaseVersion: computer.appliedReleaseVersion ?? null,
              previousReleaseVersion: computer.previousReleaseVersion ?? null,
              updateStatus: computer.updateStatus ?? 'idle',
              reprovisionRequired: Boolean(computer.reprovisionRequired),
              lastUpdateCheckAt: computer.lastUpdateCheckAt ?? null,
              lastUpdateStartedAt: computer.lastUpdateStartedAt ?? null,
              lastUpdateCompletedAt: computer.lastUpdateCompletedAt ?? null,
              lastUpdateError: computer.lastUpdateError ?? null,
            },
            plugin: {
              desiredVersion: computer.desiredOverlayPluginVersion ?? null,
              installedVersion: computer.overlayPluginInstalledVersion ?? null,
              status: computer.overlayPluginHealthStatus ?? 'unknown',
              lastHealthCheckAt: computer.overlayPluginLastHealthCheckAt ?? null,
              lastError: computer.overlayPluginLastError ?? null,
            },
          }
        : null,
      workspace: {
        defaultPath: '~/.openclaw/workspace',
      },
      capabilities: COMPUTER_RESOURCE_CAPABILITIES,
      token: {
        version: auth.tokenVersion,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch computer context'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
