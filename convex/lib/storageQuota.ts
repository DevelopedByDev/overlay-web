import type { Doc } from '../_generated/dataModel'
import { getFileBandwidthBytesLimit, getOverlayStorageBytesLimit, type OverlayTier } from '../../src/lib/storage-limits'

type MutationCtxLike = any

export class StorageQuotaExceededError extends Error {
  constructor(message = 'storage_limit_exceeded') {
    super(message)
    this.name = 'StorageQuotaExceededError'
  }
}

function defaultBillingWindow(now: number) {
  return {
    currentPeriodStart: now,
    currentPeriodEnd: now + 30 * 24 * 60 * 60 * 1000,
  }
}

export async function getOrCreateSubscription(ctx: MutationCtxLike, userId: string): Promise<Doc<'subscriptions'>> {
  const existing = await ctx.db
    .query('subscriptions')
    .withIndex('by_userId', (q: any) => q.eq('userId', userId))
    .first()
  if (existing) return existing

  const now = Date.now()
  const createdId = await ctx.db.insert('subscriptions', {
    userId,
    tier: 'free',
    status: 'active',
    creditsUsed: 0,
    overlayStorageBytesUsed: 0,
    fileBandwidthBytesUsed: 0,
    fileBandwidthPeriodStart: now,
    ...defaultBillingWindow(now),
  })
  const created = await ctx.db
    .query('subscriptions')
    .withIndex('by_userId', (q: any) => q.eq('userId', userId))
    .first()
  if (!created) {
    throw new Error(`Failed to create subscription state for user ${userId}; insert=${String(createdId)}`)
  }
  return created
}

export function getSubscriptionTier(subscription: Doc<'subscriptions'> | null | undefined): OverlayTier {
  return (subscription?.tier ?? 'free') as OverlayTier
}

export function getStorageBytesUsed(subscription: Doc<'subscriptions'> | null | undefined): number {
  return Math.max(0, subscription?.overlayStorageBytesUsed ?? 0)
}

export function getCurrentBillingPeriodStart(subscription: Doc<'subscriptions'> | null | undefined): number {
  return subscription?.currentPeriodStart ?? Date.now()
}

export function getBandwidthBytesUsed(subscription: Doc<'subscriptions'> | null | undefined): number {
  if (!subscription) return 0
  const periodStart = getCurrentBillingPeriodStart(subscription)
  if ((subscription.fileBandwidthPeriodStart ?? 0) !== periodStart) return 0
  return Math.max(0, subscription.fileBandwidthBytesUsed ?? 0)
}

export function getStorageLimitForSubscription(subscription: Doc<'subscriptions'> | null | undefined): number {
  return getOverlayStorageBytesLimit(getSubscriptionTier(subscription))
}

export function getBandwidthLimitForSubscription(subscription: Doc<'subscriptions'> | null | undefined): number {
  return getFileBandwidthBytesLimit(getSubscriptionTier(subscription))
}

export async function applyStorageUsageDelta(ctx: MutationCtxLike, userId: string, deltaBytes: number): Promise<Doc<'subscriptions'>> {
  const subscription = await getOrCreateSubscription(ctx, userId)
  const nextValue = Math.max(0, getStorageBytesUsed(subscription) + deltaBytes)
  await ctx.db.patch(subscription._id, { overlayStorageBytesUsed: nextValue })
  return {
    ...subscription,
    overlayStorageBytesUsed: nextValue,
  }
}

export async function ensureStorageAvailable(
  ctx: MutationCtxLike,
  userId: string,
  requiredAdditionalBytes: number,
): Promise<Doc<'subscriptions'>> {
  const subscription = await getOrCreateSubscription(ctx, userId)
  if (requiredAdditionalBytes <= 0) return subscription
  const nextValue = getStorageBytesUsed(subscription) + requiredAdditionalBytes
  const limit = getStorageLimitForSubscription(subscription)
  if (nextValue > limit) {
    throw new StorageQuotaExceededError(
      `storage_limit_exceeded:${nextValue}:${limit}`
    )
  }
  return subscription
}

export async function applyBandwidthUsage(ctx: MutationCtxLike, userId: string, bytesServed: number): Promise<Doc<'subscriptions'>> {
  const subscription = await getOrCreateSubscription(ctx, userId)
  const currentPeriodStart = getCurrentBillingPeriodStart(subscription)
  const nextValue = Math.max(0, getBandwidthBytesUsed(subscription) + bytesServed)
  await ctx.db.patch(subscription._id, {
    fileBandwidthBytesUsed: nextValue,
    fileBandwidthPeriodStart: currentPeriodStart,
  })
  return {
    ...subscription,
    fileBandwidthBytesUsed: nextValue,
    fileBandwidthPeriodStart: currentPeriodStart,
  }
}
