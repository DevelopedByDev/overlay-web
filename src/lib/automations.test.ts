import test from 'node:test'
import assert from 'node:assert/strict'

const { getNextAutomationRunAt } = await import(new URL('./automations.ts', import.meta.url).href)
const {
  shouldPauseAutomationAfterFailure,
  shouldRetryAutomationFailure,
} = await import(new URL('./automation-guardrails.ts', import.meta.url).href)
const { detectRequiredIntegrations } = await import(new URL('./automation-preflight.ts', import.meta.url).href)
const {
  buildAutomationDraftFromTurn,
  shouldSuggestAutomationFromTurn,
} = await import(new URL('./automation-drafts.ts', import.meta.url).href)
const { getAutomationExecutorBaseUrl, getBaseUrl } = await import(new URL('./url.ts', import.meta.url).href)

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

test('shouldPauseAutomationAfterFailure only pauses repeated transient failures', () => {
  assert.equal(
    shouldPauseAutomationAfterFailure({
      errorMessage: 'upstream timeout',
      failureStreak: 3,
    }),
    true,
  )

  assert.equal(
    shouldPauseAutomationAfterFailure({
      errorMessage: 'missing integration',
      failureStreak: 5,
    }),
    false,
  )
})

test('detectRequiredIntegrations finds referenced connected services', () => {
  const detected = detectRequiredIntegrations(
    'Every morning, check Gmail, update the Notion project page, and post blockers to Slack.',
  )
  assert.deepEqual(
    detected.map((integration: { slug: string }) => integration.slug),
    ['gmail', 'slack', 'notion'],
  )
})

test('detectRequiredIntegrations avoids false positives for generic scheduling copy', () => {
  const detected = detectRequiredIntegrations(
    'Create a calendar-style weekly summary and store it as a markdown note.',
  )
  assert.deepEqual(detected.map((integration: { slug: string }) => integration.slug), [])
})

test('shouldSuggestAutomationFromTurn prefers automation for recurring workflow language', () => {
  const suggestion = shouldSuggestAutomationFromTurn({
    userText: 'Every morning, check Gmail, summarize important emails, and send me the brief.',
    toolNames: ['GMAIL_LIST_MESSAGES', 'draft_automation_from_chat'],
  })
  assert.deepEqual(suggestion, {
    kind: 'automation',
    reason: 'This looks like a repeatable task with explicit recurrence language.',
    confidence: 'high',
  })
})

test('buildAutomationDraftFromTurn returns inferred schedule and integrations', () => {
  const draft = buildAutomationDraftFromTurn({
    userText: 'Every weekday, review Slack and update Notion with blockers.',
    assistantText: 'I checked Slack, collected blockers, and prepared the Notion update workflow.',
  })
  assert.equal(draft.suggestedSchedule?.kind, 'weekdays')
  assert.deepEqual(draft.detectedIntegrations, ['Slack', 'Notion'])
  assert.equal(draft.mode, 'act')
})

test('getBaseUrl prefers dev app URL in development', () => {
  const env = process.env as Record<string, string | undefined>
  const originalNodeEnv = env.NODE_ENV
  const originalAppUrl = env.NEXT_PUBLIC_APP_URL
  const originalDevAppUrl = env.DEV_NEXT_PUBLIC_APP_URL

  try {
    env.NODE_ENV = 'development'
    env.NEXT_PUBLIC_APP_URL = 'https://getoverlay.io'
    env.DEV_NEXT_PUBLIC_APP_URL = 'http://localhost:3000'

    assert.equal(getBaseUrl(), 'http://localhost:3000')
  } finally {
    env.NODE_ENV = originalNodeEnv
    env.NEXT_PUBLIC_APP_URL = originalAppUrl
    env.DEV_NEXT_PUBLIC_APP_URL = originalDevAppUrl
  }
})

test('getBaseUrl adds scheme when dev URL omits protocol (avoids Invalid URL in server fetches)', () => {
  const env = process.env as Record<string, string | undefined>
  const originalNodeEnv = env.NODE_ENV
  const originalAppUrl = env.NEXT_PUBLIC_APP_URL
  const originalDevAppUrl = env.DEV_NEXT_PUBLIC_APP_URL

  try {
    env.NODE_ENV = 'development'
    env.NEXT_PUBLIC_APP_URL = ''
    env.DEV_NEXT_PUBLIC_APP_URL = 'localhost:3000'

    assert.equal(getBaseUrl(), 'http://localhost:3000')
  } finally {
    env.NODE_ENV = originalNodeEnv
    env.NEXT_PUBLIC_APP_URL = originalAppUrl
    env.DEV_NEXT_PUBLIC_APP_URL = originalDevAppUrl
  }
})

test('getAutomationExecutorBaseUrl prefers dedicated scheduler URL when set', () => {
  const env = process.env as Record<string, string | undefined>
  const originalExecutorBaseUrl = env.AUTOMATION_EXECUTOR_BASE_URL
  const originalAppUrl = env.NEXT_PUBLIC_APP_URL

  try {
    env.AUTOMATION_EXECUTOR_BASE_URL = 'https://overlay-landing-git-automation.example.vercel.app'
    env.NEXT_PUBLIC_APP_URL = 'https://getoverlay.io'

    assert.equal(
      getAutomationExecutorBaseUrl(),
      'https://overlay-landing-git-automation.example.vercel.app',
    )
  } finally {
    env.AUTOMATION_EXECUTOR_BASE_URL = originalExecutorBaseUrl
    env.NEXT_PUBLIC_APP_URL = originalAppUrl
  }
})
