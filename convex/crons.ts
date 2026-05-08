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

export default crons
