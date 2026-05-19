/**
 * When the free tier registers stub tools for paid-only capabilities, their `execute`
 * returns this shape. The client renders a compact upgrade callout (not full-width).
 */
export type OverlayGatedFeature = 'web_search' | 'deep_research' | 'remote_browser' | 'workspace'

export type OverlayGatedToolOutput = {
  _overlayGatedFeature: true
  feature: OverlayGatedFeature
  message: string
}

export function isOverlayGatedToolOutput(output: unknown): output is OverlayGatedToolOutput {
  if (output === null || typeof output !== 'object') return false
  return (output as { _overlayGatedFeature?: unknown })._overlayGatedFeature === true
}
