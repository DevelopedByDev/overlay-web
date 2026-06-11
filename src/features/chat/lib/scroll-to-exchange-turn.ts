export function scrollToExchangeTurn(turnId: string) {
  const safe =
    typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
      ? CSS.escape(turnId)
      : turnId.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  document.querySelector(`[data-exchange-turn="${safe}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
