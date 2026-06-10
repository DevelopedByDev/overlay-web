/**
 * Height of the latest-exchange "tail" that must stay visible at the bottom of
 * the scroll viewport while a response is streaming. Scaled to the viewport but
 * clamped so it never gets too small or too large.
 */
export function streamingTailHeight(clientHeight: number): number {
  return Math.min(240, Math.max(160, clientHeight * 0.2))
}

/**
 * Size of the reserved spacer rendered below the latest exchange while
 * streaming. Sizing the spacer to `clientHeight - tail` turns the scroll limit
 * into a *natural* boundary: the user can scroll until only the tail remains
 * visible and then the container simply stops — no per-scroll JS correction
 * (which fights inertial scrolling and causes flicker) is required.
 */
export function streamingReservedSpacerHeight(clientHeight: number): number {
  return Math.max(0, clientHeight - streamingTailHeight(clientHeight))
}

export function constrainStreamingScrollTop({
  clientHeight,
  containerTop,
  markerTop,
  scrollTop,
}: {
  clientHeight: number
  containerTop: number
  markerTop: number
  scrollTop: number
}): number {
  const minimumMarkerTop = containerTop + streamingTailHeight(clientHeight)
  if (markerTop >= minimumMarkerTop) return scrollTop
  return Math.max(0, scrollTop - (minimumMarkerTop - markerTop))
}
