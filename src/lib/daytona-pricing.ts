export type DaytonaWorkspaceTier = 'pro' | 'max'

export type DaytonaWorkspaceState =
  | 'provisioning'
  | 'started'
  | 'stopped'
  | 'archived'
  | 'error'
  | 'missing'

export type DaytonaResourceProfileId = 'pro' | 'max'

export type DaytonaUsageReason =
  | 'start'
  | 'task'
  | 'stop'
  | 'archive'
  | 'resize'
  | 'reconcile'

export interface DaytonaResourceProfile {
  id: DaytonaResourceProfileId
  cpu: number
  memoryGiB: number
  diskGiB: number
  autoStopMinutes: number
  autoArchiveMinutes: number
}

export const DAYTONA_VCPU_USD_PER_SEC = 0.000014
export const DAYTONA_MEMORY_USD_PER_GIB_SEC = 0.0000045
export const DAYTONA_STORAGE_USD_PER_GIB_SEC = 0.00000003
export const DAYTONA_INCLUDED_DISK_GIB = 5

export const DAYTONA_RESOURCE_PROFILES: Record<DaytonaResourceProfileId, DaytonaResourceProfile> = {
  pro: {
    id: 'pro',
    cpu: 2,
    memoryGiB: 4,
    diskGiB: 10,
    autoStopMinutes: 15,
    autoArchiveMinutes: 24 * 60,
  },
  max: {
    id: 'max',
    cpu: 4,
    memoryGiB: 8,
    diskGiB: 20,
    autoStopMinutes: 30,
    autoArchiveMinutes: 7 * 24 * 60,
  },
}

export function getDaytonaResourceProfile(
  tier: DaytonaWorkspaceTier | DaytonaResourceProfileId,
): DaytonaResourceProfile {
  return DAYTONA_RESOURCE_PROFILES[tier]
}

export function detectDaytonaResourceProfileId(params: {
  cpu?: number
  memoryGiB?: number
  diskGiB?: number
}): DaytonaResourceProfileId | null {
  for (const profile of Object.values(DAYTONA_RESOURCE_PROFILES)) {
    if (
      profile.cpu === params.cpu &&
      profile.memoryGiB === params.memoryGiB &&
      profile.diskGiB === params.diskGiB
    ) {
      return profile.id
    }
  }
  return null
}

export function roundCurrencyAmount(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.round(value * 10_000) / 10_000
}

export function computeDaytonaRuntimeCost(params: {
  cpu: number
  memoryGiB: number
  diskGiB: number
  elapsedSeconds: number
}): { costUsd: number; costCents: number } {
  const elapsedSeconds = Math.max(0, params.elapsedSeconds)
  const diskBillableGiB = Math.max(0, params.diskGiB - DAYTONA_INCLUDED_DISK_GIB)

  const costUsd = roundCurrencyAmount(
    elapsedSeconds * (
      params.cpu * DAYTONA_VCPU_USD_PER_SEC +
      params.memoryGiB * DAYTONA_MEMORY_USD_PER_GIB_SEC +
      diskBillableGiB * DAYTONA_STORAGE_USD_PER_GIB_SEC
    ),
  )

  return {
    costUsd,
    costCents: roundCurrencyAmount(costUsd * 100),
  }
}
