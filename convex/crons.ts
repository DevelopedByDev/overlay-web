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

export default crons
