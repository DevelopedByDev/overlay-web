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
  const minimumVisibleTail = Math.min(240, Math.max(160, clientHeight * 0.2))
  const minimumMarkerTop = containerTop + minimumVisibleTail
  if (markerTop >= minimumMarkerTop) return scrollTop
  return Math.max(0, scrollTop - (minimumMarkerTop - markerTop))
}
