/**
 * Models often concatenate segments without a space after a period ("setup.Perfect!").
 * Insert a space when a lowercase letter is followed by `.` and an uppercase letter.
 */
export function normalizeAgentAssistantText(s: string): string {
  if (!s.trim()) return s
  return s.replace(/([a-z])\.([A-Z])/g, '$1. $2')
}
