'use client'

import React, { useRef, useState } from 'react'

const SHOW_DELAY_MS = 450

/**
 * Tooltip with delayed show and immediate hide when the cursor leaves the wrapper.
 * @param side `top` = above the trigger (default). `bottom` = below (avoids clipping under page/header edges).
 */
export function DelayedTooltip({
  label,
  children,
  className = '',
  side = 'top',
}: {
  label: string
  children: React.ReactNode
  className?: string
  side?: 'top' | 'bottom'
}) {
  const [open, setOpen] = useState(false)
  /** DOM timers use numeric handles; avoids NodeJS.Timeout vs number mismatch in client builds. */
  const timerRef = useRef<number | null>(null)

  function show() {
    if (timerRef.current != null) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => setOpen(true), SHOW_DELAY_MS)
  }

  function hide() {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    setOpen(false)
  }

  return (
    <span
      className={className ? `relative ${className}` : 'relative inline-flex'}
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      {children}
      {open && (
        <span
          role="tooltip"
          className={`pointer-events-none absolute left-1/2 z-[60] -translate-x-1/2 whitespace-nowrap rounded-md border border-[#e5e5e5] bg-[#f0f0f0] px-2 py-1 text-[11px] font-medium text-[#525252] shadow-sm ${
            side === 'bottom'
              ? 'top-full mt-1.5'
              : 'bottom-full mb-1.5'
          }`}
        >
          {label}
        </span>
      )}
    </span>
  )
}
