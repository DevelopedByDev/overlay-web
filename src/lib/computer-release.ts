import { OPENCLAW_OVERLAY_PLUGIN_VERSION } from './openclaw-overlay-plugin-bundle'

export type ComputerUpdateChannel = 'stable' | 'canary'

export type ComputerReleaseUpdateStrategy = 'in_place' | 'reprovision_required'

export type ComputerUpdateStatus =
  | 'idle'
  | 'checking'
  | 'downloading'
  | 'applying'
  | 'restarting'
  | 'verifying'
  | 'ready'
  | 'reprovision_required'
  | 'error'

export interface ComputerReleaseManifest {
  version: string
  channel: ComputerUpdateChannel
  openclawImage: string
  toolBundleVersion: string
  overlayPluginVersion: string
  configVersion: string
  updateStrategy: ComputerReleaseUpdateStrategy
  minUpdaterVersion: string
}

export const DEFAULT_COMPUTER_UPDATE_CHANNEL: ComputerUpdateChannel = 'stable'
export const DEFAULT_COMPUTER_UPDATER_VERSION = '1.0.0'
export const DEFAULT_COMPUTER_UPDATER_POLL_SECONDS = 600
export const DEFAULT_COMPUTER_OPENCLAW_IMAGE =
  process.env.OPENCLAW_IMAGE?.trim() || 'ghcr.io/openclaw/openclaw:main'
export const DEFAULT_COMPUTER_RELEASE_VERSION =
  process.env.COMPUTER_RELEASE_VERSION?.trim() || '2026.03.27.1'
export const DEFAULT_COMPUTER_TOOL_BUNDLE_VERSION =
  process.env.COMPUTER_TOOL_BUNDLE_VERSION?.trim() || DEFAULT_COMPUTER_RELEASE_VERSION
export const DEFAULT_COMPUTER_OVERLAY_PLUGIN_VERSION =
  process.env.COMPUTER_OVERLAY_PLUGIN_VERSION?.trim() || OPENCLAW_OVERLAY_PLUGIN_VERSION
export const DEFAULT_COMPUTER_CONFIG_VERSION =
  process.env.COMPUTER_CONFIG_VERSION?.trim() || '1'

export function buildComputerReleaseManifest(
  overrides?: Partial<ComputerReleaseManifest>,
): ComputerReleaseManifest {
  return {
    version: overrides?.version?.trim() || DEFAULT_COMPUTER_RELEASE_VERSION,
    channel: overrides?.channel || DEFAULT_COMPUTER_UPDATE_CHANNEL,
    openclawImage: overrides?.openclawImage?.trim() || DEFAULT_COMPUTER_OPENCLAW_IMAGE,
    toolBundleVersion:
      overrides?.toolBundleVersion?.trim() || DEFAULT_COMPUTER_TOOL_BUNDLE_VERSION,
    overlayPluginVersion:
      overrides?.overlayPluginVersion?.trim() || DEFAULT_COMPUTER_OVERLAY_PLUGIN_VERSION,
    configVersion: overrides?.configVersion?.trim() || DEFAULT_COMPUTER_CONFIG_VERSION,
    updateStrategy: overrides?.updateStrategy || 'in_place',
    minUpdaterVersion:
      overrides?.minUpdaterVersion?.trim() || DEFAULT_COMPUTER_UPDATER_VERSION,
  }
}

export function serializeComputerReleaseManifest(manifest: ComputerReleaseManifest): string {
  return JSON.stringify(manifest)
}

export function parseComputerReleaseManifest(
  manifestJson: string | null | undefined,
): ComputerReleaseManifest {
  if (!manifestJson?.trim()) {
    return buildComputerReleaseManifest()
  }

  try {
    const parsed = JSON.parse(manifestJson) as Partial<ComputerReleaseManifest>
    return buildComputerReleaseManifest(parsed)
  } catch {
    return buildComputerReleaseManifest()
  }
}

export function isProgressComputerUpdateStatus(status: ComputerUpdateStatus | null | undefined): boolean {
  return (
    status === 'checking' ||
    status === 'downloading' ||
    status === 'applying' ||
    status === 'restarting' ||
    status === 'verifying'
  )
}
