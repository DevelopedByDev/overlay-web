import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()

// Daytona webhooks may later accelerate reconciliation, but this cron remains the billing truth.
crons.interval(
  'daytona workspace reconciliation',
  { minutes: 1 },
  internal.daytonaReconcile.runMinuteTick,
)

crons.interval(
  'automation scheduler',
  { minutes: 1 },
  internal.automationRunner.runMinuteTick,
)

crons.interval(
  'stale generating message cleanup',
  { minutes: 2 },
  internal.conversations.runStaleGeneratingCleanup,
)

// Defense-in-depth: catches stream delta rows whose parent message is no longer
// `generating`. Do not age-expire deltas here; some tasks can legitimately run long.
crons.interval(
  'orphan message delta cleanup',
  { hours: 6 },
  internal.conversations.runOrphanDeltaCleanup,
)

// Removes conversations that were created (e.g. user opened a new chat) but never
// received a single message. Reduces storage and keeps the sidebar list clean.
crons.interval(
  'empty conversation cleanup',
  { minutes: 30 },
  internal.conversations.runEmptyConversationCleanup,
)

crons.interval(
  'service auth replay nonce cleanup',
  { hours: 1 },
  internal.serviceAuth.cleanupExpiredReplayNoncesInternal,
  {},
)

export default crons
