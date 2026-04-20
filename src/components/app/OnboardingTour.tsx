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
  const th = 200

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
  } else if (placement === 'bottom') {
    top = rect.top + rect.height + 16
    left = rect.left + rect.width / 2 - tw / 2
    arrow = 'top'
    if (top + th > vh - 8) {
      top = rect.top - th - 16
      arrow = 'bottom'
    }
  } else {
    top = rect.top - th - 16
    left = rect.left + rect.width / 2 - tw / 2
    arrow = 'bottom'
    if (top < 8) {
      top = rect.top + rect.height + 16
      arrow = 'top'
    }
  }

  top = Math.max(8, Math.min(top, vh - th - 8))
  left = Math.max(8, Math.min(left, vw - tw - 8))

  const style: CSSProperties = {
    position: 'fixed',
    zIndex: 9999,
    top,
    left,
    width: tw,
  }

  const rectCenter = rect.left + rect.width / 2
  const clampedArrowOffset = Math.max(
    ARROW_SIZE * 2,
    Math.min(tw - ARROW_SIZE * 2, rectCenter - left),
  )

  const arrowStyle: CSSProperties = (() => {
    if (arrow === 'left') return {
      position: 'absolute',
      top: '50%',
      left: -ARROW_SIZE * 2,
      transform: 'translateY(-50%)',
      borderRight: `${ARROW_SIZE}px solid var(--surface-elevated)`,
      borderTop: `${ARROW_SIZE}px solid transparent`,
      borderBottom: `${ARROW_SIZE}px solid transparent`,
      borderLeft: 'none',
    }
    if (arrow === 'right') return {
      position: 'absolute',
      top: '50%',
      right: -ARROW_SIZE * 2,
      transform: 'translateY(-50%)',
      borderLeft: `${ARROW_SIZE}px solid var(--surface-elevated)`,
      borderTop: `${ARROW_SIZE}px solid transparent`,
      borderBottom: `${ARROW_SIZE}px solid transparent`,
      borderRight: 'none',
    }
    if (arrow === 'top') return {
      position: 'absolute',
      top: -ARROW_SIZE * 2,
      left: clampedArrowOffset - ARROW_SIZE,
      borderBottom: `${ARROW_SIZE}px solid var(--surface-elevated)`,
      borderTop: 'none',
      borderLeft: `${ARROW_SIZE}px solid transparent`,
      borderRight: `${ARROW_SIZE}px solid transparent`,
    }
    return {
      position: 'absolute',
      bottom: -ARROW_SIZE * 2,
      left: clampedArrowOffset - ARROW_SIZE,
      borderTop: `${ARROW_SIZE}px solid var(--surface-elevated)`,
      borderBottom: 'none',
      borderLeft: `${ARROW_SIZE}px solid transparent`,
      borderRight: `${ARROW_SIZE}px solid transparent`,
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
    const target = steps[currentStep]?.target ?? 'model-picker'
    // 1. Open the dropdown
    const t1 = window.setTimeout(() => {
      window.dispatchEvent(new Event('overlay:tour:open-model-picker'))
    }, 150)
    // 2. Re-measure after dropdown renders so querySelectorAll unions button + open dropdown
    const t2 = window.setTimeout(() => measure(currentStep, target), 300)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
      window.dispatchEvent(new Event('overlay:tour:close-model-picker'))
    }
  }, [currentStep, isClosing, measure, steps])

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

  const visible = frame.stepIndex === currentStep && frame.rect !== null && !isClosing
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
          <div style={tooltipInfo.arrowStyle} aria-hidden />

          <div className="mb-3 flex items-start justify-between gap-3">
            <span className="text-[11px] font-medium tabular-nums text-[var(--muted)]">
              {currentStep + 1} / {steps.length}
            </span>
            <button
              type="button"
              onClick={onSkip}
              className="rounded p-0.5 text-[var(--muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]"
              aria-label="Close tour"
            >
              <X size={14} />
            </button>
          </div>

          <h3 className="mb-1.5 text-base font-semibold text-[var(--foreground)]">{step.title}</h3>
          <p className="mb-5 text-sm leading-relaxed text-[var(--muted)]">{step.description}</p>

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={onSkip}
              className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
            >
              Skip tour
            </button>
            <div className="flex gap-2">
              {currentStep > 0 && (
                <button
                  type="button"
                  onClick={onBack}
                  className="rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-1.5 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-elevated)]"
                >
                  Back
                </button>
              )}
              <button
                type="button"
                onClick={isLast ? onDone : onNext}
                className="flex items-center gap-1.5 rounded-lg bg-[var(--foreground)] px-4 py-1.5 text-sm font-medium text-[var(--background)]"
              >
                {isLast ? (
                  <>Get started</>
                ) : (
                  <>Next <ArrowRight size={13} /></>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
