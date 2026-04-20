'use client'

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useCallback,
  type CSSProperties,
} from 'react'
import { X, ArrowRight } from 'lucide-react'

export interface TourStep {
  /** data-tour attribute value of the target element */
  target: string
  title: string
  description: string
  /** Preferred tooltip placement relative to target */
  placement?: 'right' | 'left' | 'top' | 'bottom'
}

interface Props {
  steps: TourStep[]
  currentStep: number
  onNext: () => void
  onBack: () => void
  onSkip: () => void
  onDone: () => void
  isClosing?: boolean
}

const PADDING = 10
const TOOLTIP_WIDTH = 300
const ARROW_SIZE = 8

interface Rect { top: number; left: number; width: number; height: number }

function getTargetRect(target: string): Rect | null {
  const els = document.querySelectorAll(`[data-tour="${target}"]`)
  if (els.length === 0) return null
  let minTop = Infinity, minLeft = Infinity, maxBottom = -Infinity, maxRight = -Infinity
  let hasVisible = false
  for (const el of els) {
    const r = el.getBoundingClientRect()
    if (r.width === 0 && r.height === 0) continue
    hasVisible = true
    if (r.top < minTop) minTop = r.top
    if (r.left < minLeft) minLeft = r.left
    if (r.bottom > maxBottom) maxBottom = r.bottom
    if (r.right > maxRight) maxRight = r.right
  }
  if (!hasVisible) return null
  return {
    top: minTop - PADDING,
    left: minLeft - PADDING,
    width: (maxRight - minLeft) + PADDING * 2,
    height: (maxBottom - minTop) + PADDING * 2,
  }
}

function computeTooltipStyle(
  rect: Rect,
  placement: TourStep['placement'] = 'right',
): { style: CSSProperties; arrowStyle: CSSProperties; arrow: 'left' | 'right' | 'top' | 'bottom' } {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const tw = TOOLTIP_WIDTH
  const th = 200 // estimated tooltip height

  let top = 0
  let left = 0
  let arrow: 'left' | 'right' | 'top' | 'bottom' = 'left'

  if (placement === 'right') {
    const candidate = rect.left + rect.width + 16
    if (candidate + tw < vw - 8) {
      left = candidate
      top = rect.top + rect.height / 2 - th / 2
      arrow = 'left'
    } else {
      left = rect.left - tw - 16
      top = rect.top + rect.height / 2 - th / 2
      arrow = 'right'
    }
  } else if (placement === 'left') {
    left = rect.left - tw - 16
    top = rect.top + rect.height / 2 - th / 2
    arrow = 'right'
    if (left < 8) {
      left = rect.left + rect.width + 16
      arrow = 'left'
    }
  } else if (placement === 'top') {
    top = rect.top - th - 16
    left = rect.left + rect.width / 2 - tw / 2
    arrow = 'bottom'
    if (top < 8) {
      top = rect.top + rect.height + 16
      arrow = 'top'
    }
  } else {
    top = rect.top + rect.height + 16
    left = rect.left + rect.width / 2 - tw / 2
    arrow = 'top'
    if (top + th > vh - 8) {
      top = rect.top - th - 16
      arrow = 'bottom'
    }
  }

  top = Math.max(8, Math.min(top, vh - th - 8))
  left = Math.max(8, Math.min(left, vw - tw - 8))

  const style: CSSProperties = {
    position: 'fixed',
    top,
    left,
    width: tw,
    zIndex: 9999,
  }

  const arrowOffset = arrow === 'left' || arrow === 'right'
    ? Math.min(Math.max(rect.top + rect.height / 2 - top, 20), 140)
    : Math.min(Math.max(rect.left + rect.width / 2 - left, 20), tw - 20)

  const arrowStyle: CSSProperties = (() => {
    const base: CSSProperties = {
      position: 'absolute',
      width: 0,
      height: 0,
      border: `${ARROW_SIZE}px solid transparent`,
    }
    if (arrow === 'left') {
      return {
        ...base,
        left: -ARROW_SIZE * 2,
        top: arrowOffset - ARROW_SIZE,
        borderRight: `${ARROW_SIZE}px solid var(--surface-elevated)`,
        borderLeft: 'none',
      }
    }
    if (arrow === 'right') {
      return {
        ...base,
        right: -ARROW_SIZE * 2,
        top: arrowOffset - ARROW_SIZE,
        borderLeft: `${ARROW_SIZE}px solid var(--surface-elevated)`,
        borderRight: 'none',
      }
    }
    if (arrow === 'top') {
      return {
        ...base,
        top: -ARROW_SIZE * 2,
        left: arrowOffset - ARROW_SIZE,
        borderBottom: `${ARROW_SIZE}px solid var(--surface-elevated)`,
        borderTop: 'none',
      }
    }
    return {
      ...base,
      bottom: -ARROW_SIZE * 2,
      left: arrowOffset - ARROW_SIZE,
      borderTop: `${ARROW_SIZE}px solid var(--surface-elevated)`,
      borderBottom: 'none',
    }
  })()

  return { style, arrowStyle, arrow }
}

interface Frame { rect: Rect | null; stepIndex: number; spotlightRect: Rect | null }

export function OnboardingTour({
  steps,
  currentStep,
  onNext,
  onBack,
  onSkip,
  onDone,
  isClosing = false,
}: Props) {
  const step = steps[currentStep]
  const [frame, setFrame] = useState<Frame>({ rect: null, stepIndex: -1, spotlightRect: null })
  const [backdropReady, setBackdropReady] = useState(false)
  const rafRef = useRef<number | null>(null)
  const observerRef = useRef<ResizeObserver | null>(null)

  const measure = useCallback((idx: number, target: string) => {
    const r = getTargetRect(target)
    // spotlightRect persists the last valid rect so the backdrop never flickers between steps
    setFrame(prev => ({ rect: r, stepIndex: idx, spotlightRect: r ?? prev.spotlightRect }))
  }, [])

  useLayoutEffect(() => {
    const raf = requestAnimationFrame(() => setBackdropReady(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  useLayoutEffect(() => {
    if (!step) return

    const idx = currentStep
    const target = step.target

    const doMeasure = () => {
      rafRef.current = null
      measure(idx, target)
    }

    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = requestAnimationFrame(doMeasure)
    })

    observerRef.current = new ResizeObserver(() => measure(idx, target))
    document.querySelectorAll(`[data-tour="${target}"]`).forEach(el => observerRef.current!.observe(el))
    observerRef.current.observe(document.body)

    const onResize = () => measure(idx, target)
    window.addEventListener('resize', onResize)
    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      observerRef.current?.disconnect()
      window.removeEventListener('resize', onResize)
    }
  }, [currentStep, step, measure])

  // Open/close the model picker when step 0 is active
  useEffect(() => {
    if (currentStep !== 0 || isClosing) return
    const t = window.setTimeout(() => {
      window.dispatchEvent(new Event('overlay:tour:open-model-picker'))
    }, 150)
    return () => {
      window.clearTimeout(t)
      window.dispatchEvent(new Event('overlay:tour:close-model-picker'))
    }
  }, [currentStep, isClosing])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onSkip()
      if (e.key === 'ArrowRight' || e.key === 'Enter') {
        if (currentStep < steps.length - 1) onNext()
        else onDone()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [currentStep, steps.length, onNext, onDone, onSkip])

  if (!step) return null

  const rect = frame.stepIndex === currentStep ? frame.rect : null
  const spotlightRect = frame.spotlightRect

  // Tooltip visible only when the current step's rect is freshly measured
  const visible = frame.stepIndex === currentStep && frame.rect !== null && !isClosing
  // Backdrop stays visible for the whole tour (fades in on mount, out on close only)
  const backdropOpacity = backdropReady && !isClosing ? 1 : 0

  const tooltipInfo = rect
    ? computeTooltipStyle(rect, step.placement ?? 'right')
    : null

  const isLast = currentStep === steps.length - 1

  return (
    <>
      {/* Backdrop with box-shadow cutout */}
      <div
        aria-hidden
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9998,
          pointerEvents: 'none',
          transition: 'opacity 400ms ease',
          opacity: backdropOpacity,
        }}
      >
        {spotlightRect && (
          <div
            style={{
              position: 'absolute',
              top: spotlightRect.top,
              left: spotlightRect.left,
              width: spotlightRect.width,
              height: spotlightRect.height,
              borderRadius: 8,
              boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)',
              transition: 'top 400ms ease, left 400ms ease, width 400ms ease, height 400ms ease',
            }}
          />
        )}
        {/* full-screen click blocker except the cutout */}
        {spotlightRect && (
          <>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: spotlightRect.top, pointerEvents: 'auto' }} onClick={onSkip} />
            <div style={{ position: 'absolute', top: spotlightRect.top + spotlightRect.height, left: 0, right: 0, bottom: 0, pointerEvents: 'auto' }} onClick={onSkip} />
            <div style={{ position: 'absolute', top: spotlightRect.top, left: 0, width: spotlightRect.left, height: spotlightRect.height, pointerEvents: 'auto' }} onClick={onSkip} />
            <div style={{ position: 'absolute', top: spotlightRect.top, left: spotlightRect.left + spotlightRect.width, right: 0, height: spotlightRect.height, pointerEvents: 'auto' }} onClick={onSkip} />
          </>
        )}
        {!spotlightRect && (
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'auto' }} onClick={onSkip} />
        )}
      </div>

      {/* Tooltip card */}
      {tooltipInfo && (
        <div
          role="dialog"
          aria-label={`Onboarding step ${currentStep + 1} of ${steps.length}`}
          style={{
            ...tooltipInfo.style,
            opacity: visible ? 1 : 0,
            transform: visible ? 'scale(1)' : 'scale(0.95)',
            transition: 'opacity 400ms ease, transform 400ms ease',
          }}
          className="rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-5 shadow-2xl"
        >
          {/* Arrow */}
          <div style={tooltipInfo.arrowStyle} aria-hidden />

          {/* Header */}
          <div className="mb-3 flex items-start justify-between gap-3">
            <span className="text-[11px] font-medium tabular-nums text-[var(--muted)]">
              {currentStep + 1} / {steps.length}
            </span>
            <button
              type="button"
              onClick={onSkip}
              aria-label="Skip tour"
              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[var(--muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]"
            >
              <X size={13} />
            </button>
          </div>

          {/* Content */}
          <h3 className="mb-1.5 text-sm font-semibold text-[var(--foreground)]">{step.title}</h3>
          <p className="mb-5 text-xs leading-relaxed text-[var(--muted)]">{step.description}</p>

          {/* Footer */}
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={onSkip}
              className="text-xs text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
            >
              Skip tour
            </button>
            <div className="flex items-center gap-2">
              {currentStep > 0 && (
                <button
                  type="button"
                  onClick={onBack}
                  className="rounded-md px-3 py-1.5 text-xs text-[var(--muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]"
                >
                  Back
                </button>
              )}
              <button
                type="button"
                onClick={isLast ? onDone : onNext}
                className="inline-flex items-center gap-1.5 rounded-md bg-[var(--foreground)] px-3 py-1.5 text-xs font-medium text-[var(--background)] transition-opacity hover:opacity-80"
              >
                {isLast ? (
                  <>Get started</>
                ) : (
                  <>
                    Next
                    <ArrowRight size={11} />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
