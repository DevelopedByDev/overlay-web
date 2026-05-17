export const AUTO_CONTINUE_TIMEOUT_PATTERN = /\[Request timed out after \d+s\. Continue\?\]/

export interface AutoContinueDecisionInput {
  messageId: string | null | undefined
  status: string | null | undefined
  text: string
  seenMessageIds?: ReadonlySet<string>
}

export function shouldAutoContinueAssistantResponse({
  messageId,
  status,
  text,
  seenMessageIds,
}: AutoContinueDecisionInput): boolean {
  if (!messageId) return false
  if (status !== 'completed') return false
  if (seenMessageIds?.has(messageId)) return false
  return AUTO_CONTINUE_TIMEOUT_PATTERN.test(text)
}
