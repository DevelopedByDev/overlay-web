export const MAX_AUTOMATION_ATTEMPTS = 2
export const AUTOMATION_RETRY_DELAY_MS = 60_000
export const MAX_RUNNING_AUTOMATIONS_PER_USER = 2
export const MAX_AUTOMATION_FAILURE_STREAK = 3
export const AUTOMATION_TIMEOUT_MS = 6 * 60 * 1000

const NON_RETRYABLE_ERROR_PATTERNS = [
  /unauthorized/i,
  /not found/i,
  /missing/i,
  /insufficient_credits/i,
  /generation_not_allowed/i,
  /premium_model_not_allowed/i,
  /sandbox_not_allowed/i,
  /storage_limit_exceeded/i,
  /requires pro/i,
  /requires a pro subscription/i,
]

function buildFailureText(input: {
  errorCode?: string
  errorMessage?: string
}): string {
  return `${input.errorCode ?? ''} ${input.errorMessage ?? ''}`.trim()
}

export function isDeterministicAutomationFailure(input: {
  errorCode?: string
  errorMessage?: string
}): boolean {
  const text = buildFailureText(input)
  if (!text) return false
  return NON_RETRYABLE_ERROR_PATTERNS.some((pattern) => pattern.test(text))
}

export function shouldRetryAutomationFailure(input: {
  errorCode?: string
  errorMessage?: string
  attemptNumber?: number
  triggerSource?: 'manual' | 'schedule' | 'retry'
}): boolean {
  if (input.triggerSource === 'manual') return false
  if ((input.attemptNumber ?? 1) >= MAX_AUTOMATION_ATTEMPTS) return false

  const text = buildFailureText(input)
  if (!text) return true

  return !isDeterministicAutomationFailure(input)
}

export function shouldPauseAutomationAfterFailure(input: {
  errorCode?: string
  errorMessage?: string
  failureStreak?: number
}): boolean {
  if (isDeterministicAutomationFailure(input)) return false
  return (input.failureStreak ?? 0) >= MAX_AUTOMATION_FAILURE_STREAK
}
