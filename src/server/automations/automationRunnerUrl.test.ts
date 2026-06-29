import assert from 'node:assert/strict'
import test from 'node:test'
import { getAutomationRunnerBaseUrl } from '../../../convex/automations/automationRunner'

const ENV_KEYS = [
  'AUTOMATION_RUNNER_BASE_URL',
  'NEXT_PUBLIC_APP_URL',
  'VERCEL_URL',
  'DEV_NEXT_PUBLIC_APP_URL',
] as const

function withEnv(
  env: Partial<Record<typeof ENV_KEYS[number], string | undefined>>,
  fn: () => void,
) {
  const previous = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]))
  try {
    for (const key of ENV_KEYS) {
      const value = env[key]
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
    fn()
  } finally {
    for (const key of ENV_KEYS) {
      const value = previous[key]
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
  }
}

test('getAutomationRunnerBaseUrl prefers explicit and canonical app URLs before dev override', () => {
  withEnv({
    AUTOMATION_RUNNER_BASE_URL: 'https://runner.test/',
    NEXT_PUBLIC_APP_URL: 'https://app.test/',
    VERCEL_URL: 'vercel-app.test',
    DEV_NEXT_PUBLIC_APP_URL: 'http://localhost:3000/',
  }, () => {
    assert.equal(getAutomationRunnerBaseUrl(), 'https://runner.test')
  })

  withEnv({
    NEXT_PUBLIC_APP_URL: 'https://app.test/',
    VERCEL_URL: 'vercel-app.test',
    DEV_NEXT_PUBLIC_APP_URL: 'http://localhost:3000/',
  }, () => {
    assert.equal(getAutomationRunnerBaseUrl(), 'https://app.test')
  })

  withEnv({
    VERCEL_URL: 'vercel-app.test',
    DEV_NEXT_PUBLIC_APP_URL: 'http://localhost:3000/',
  }, () => {
    assert.equal(getAutomationRunnerBaseUrl(), 'https://vercel-app.test')
  })

  withEnv({
    DEV_NEXT_PUBLIC_APP_URL: 'http://localhost:3000/',
  }, () => {
    assert.equal(getAutomationRunnerBaseUrl(), 'http://localhost:3000')
  })
})
