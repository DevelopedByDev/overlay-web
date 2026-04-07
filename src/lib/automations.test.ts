import test from 'node:test'
import assert from 'node:assert/strict'
import { getNextAutomationRunAt } from './automations.ts'
import { shouldRetryAutomationFailure } from './automation-guardrails.ts'

test('getNextAutomationRunAt returns future once schedule or undefined when elapsed', () => {
  const future = Date.UTC(2026, 0, 1, 12, 0, 0)
  assert.equal(
    getNextAutomationRunAt({
      scheduleKind: 'once',
      scheduleConfig: { onceAt: future },
      timezone: 'UTC',
      afterTimestamp: future - 1_000,
    }),
    future,
  )

  assert.equal(
    getNextAutomationRunAt({
      scheduleKind: 'once',
      scheduleConfig: { onceAt: future },
      timezone: 'UTC',
      afterTimestamp: future,
    }),
    undefined,
  )
})

test('getNextAutomationRunAt computes next daily occurrence in timezone', () => {
  const afterTimestamp = Date.UTC(2026, 0, 1, 10, 30, 0)
  assert.equal(
    getNextAutomationRunAt({
      scheduleKind: 'daily',
      scheduleConfig: { localTime: '09:00' },
      timezone: 'UTC',
      afterTimestamp,
    }),
    Date.UTC(2026, 0, 2, 9, 0, 0),
  )
})

test('getNextAutomationRunAt computes next selected weekday occurrence', () => {
  const afterTimestamp = Date.UTC(2026, 0, 6, 8, 0, 0) // Tue
  assert.equal(
    getNextAutomationRunAt({
      scheduleKind: 'weekly',
      scheduleConfig: { localTime: '09:00', weekdays: [1, 3] },
      timezone: 'UTC',
      afterTimestamp,
    }),
    Date.UTC(2026, 0, 7, 9, 0, 0), // Wed
  )
})

test('getNextAutomationRunAt clamps monthly day to month end', () => {
  const afterTimestamp = Date.UTC(2026, 3, 1, 0, 0, 0) // Apr 1
  assert.equal(
    getNextAutomationRunAt({
      scheduleKind: 'monthly',
      scheduleConfig: { localTime: '09:00', dayOfMonth: 31 },
      timezone: 'UTC',
      afterTimestamp,
    }),
    Date.UTC(2026, 3, 30, 9, 0, 0),
  )
})

test('shouldRetryAutomationFailure allows one transient retry only', () => {
  assert.equal(
    shouldRetryAutomationFailure({
      triggerSource: 'schedule',
      attemptNumber: 1,
      errorMessage: 'fetch failed: upstream timeout',
    }),
    true,
  )

  assert.equal(
    shouldRetryAutomationFailure({
      triggerSource: 'schedule',
      attemptNumber: 2,
      errorMessage: 'fetch failed: upstream timeout',
    }),
    false,
  )
})

test('shouldRetryAutomationFailure never retries manual or permanent failures', () => {
  assert.equal(
    shouldRetryAutomationFailure({
      triggerSource: 'manual',
      attemptNumber: 1,
      errorMessage: 'fetch failed: upstream timeout',
    }),
    false,
  )

  assert.equal(
    shouldRetryAutomationFailure({
      triggerSource: 'schedule',
      attemptNumber: 1,
      errorMessage: 'insufficient_credits',
    }),
    false,
  )
})
