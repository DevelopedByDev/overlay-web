'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { OnboardingTour, type TourStep } from './OnboardingTour'

const TOUR_STEPS: TourStep[] = [
  {
    target: 'model-picker',
    title: 'Talk to the best models',
    description:
      'Pick any AI model from the dropdown — or run multiple in parallel to compare answers side by side.',
    placement: 'right',
  },
  {
    target: 'generation-mode-toggle',
    title: 'Generate images & video',
    description:
      'Switch between Text, Image, and Video generation right from the composer. The best generative models are one tap away.',
    placement: 'bottom',
  },
  {
    target: 'nav-knowledge',
    title: 'All your knowledge in one place',
    description:
      "Store memories, files, connectors, skills, and MCPs — your AI's long-term context and extensions, always at hand.",
    placement: 'right',
  },
  {
    target: 'nav-automations',
    title: 'Run automations autonomously',
    description:
      "Build workflows that run on their own — no manual prompting needed. Set them up once and let them work in the background.",
    placement: 'right',
  },
]

interface OnboardingContextType {
  startTour: () => void
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined)

export function useOnboarding(): OnboardingContextType {
  const ctx = useContext(OnboardingContext)
  if (!ctx) throw new Error('useOnboarding must be used within OnboardingProvider')
  return ctx
}

async function markComplete() {
  try {
    await fetch('/api/app/onboarding/complete', { method: 'POST' })
  } catch {
    // non-fatal
  }
}

/** Simple welcome card for mobile (< md) where the sidebar is a flyout */
function MobileWelcomeCard({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(0,0,0,0.55)' }}
      onClick={onDismiss}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="absolute bottom-6 left-4 right-4 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-5 shadow-2xl"
      >
        <h3 className="mb-2 text-sm font-semibold text-[var(--foreground)]">Welcome to Overlay</h3>
        <ul className="mb-5 space-y-1.5 text-xs text-[var(--muted)]">
          <li>💬 <strong className="text-[var(--foreground)]">Chat</strong> — talk to the best models, or multiple at once</li>
          <li>🎨 <strong className="text-[var(--foreground)]">Generate</strong> — images & video with best-in-class models</li>
          <li>🧠 <strong className="text-[var(--foreground)]">Knowledge</strong> — memories, files, connectors, skills & MCPs</li>
          <li>⚡ <strong className="text-[var(--foreground)]">Automations</strong> — workflows that run themselves</li>
        </ul>
        <button
          type="button"
          onClick={onDismiss}
          className="w-full rounded-md bg-[var(--foreground)] py-2 text-xs font-medium text-[var(--background)] transition-opacity hover:opacity-80"
        >
          Get started
        </button>
      </div>
    </div>
  )
}

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const [active, setActive] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [isMobile, setIsMobile] = useState(false)
  const checkedRef = useRef(false)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMobile(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    if (isLoading || !isAuthenticated || checkedRef.current) return
    checkedRef.current = true

    const fromCallback = searchParams?.get('onboarding') === '1'

    if (fromCallback) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCurrentStep(0)
      setActive(true)
      return
    }

    // Check server flag for returning users on fresh page loads
    void (async () => {
      try {
        const res = await fetch('/api/app/onboarding/status')
        if (!res.ok) return
        const data = await res.json() as { hasSeenOnboarding: boolean }
        if (!data.hasSeenOnboarding) {
          setCurrentStep(0)
          setActive(true)
        }
      } catch {
        // non-fatal
      }
    })()
  }, [isLoading, isAuthenticated, searchParams])

  // Replay from settings: ?tour=replay can arrive at any time (no checkedRef guard)
  useEffect(() => {
    if (!isAuthenticated || searchParams?.get('tour') !== 'replay') return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentStep(0)
    setActive(true)
  }, [isAuthenticated, searchParams])

  const startTour = useCallback(() => {
    setCurrentStep(0)
    setActive(true)
  }, [])

  const closeTour = useCallback(() => {
    if (currentStep === 0) {
      window.dispatchEvent(new Event('overlay:tour:close-model-picker'))
    }
    setIsClosing(true)
    void markComplete()
    setTimeout(() => {
      setActive(false)
      setIsClosing(false)
    }, 220)
  }, [currentStep])

  // Steps 0 and 1 require /app/chat (model picker + generation mode toggle).
  const CHAT_PATH = '/app/chat'
  const navigateForStep = useCallback(
    (step: number) => {
      if ((step === 0 || step === 1) && !pathname?.startsWith(CHAT_PATH)) {
        router.push(CHAT_PATH)
      }
    },
    [pathname, router],
  )

  // Dispatch model picker open/close events when entering/leaving step 0.
  const handleNext = useCallback(() => {
    const next = currentStep + 1
    if (currentStep === 0) {
      window.dispatchEvent(new Event('overlay:tour:close-model-picker'))
    }
    if (next === 0) {
      window.dispatchEvent(new Event('overlay:tour:open-model-picker'))
    }
    navigateForStep(next)
    setCurrentStep(next)
  }, [currentStep, navigateForStep])

  const handleBack = useCallback(() => {
    const prev = currentStep - 1
    if (currentStep === 0) {
      window.dispatchEvent(new Event('overlay:tour:close-model-picker'))
    }
    if (prev === 0) {
      window.dispatchEvent(new Event('overlay:tour:open-model-picker'))
    }
    navigateForStep(prev)
    setCurrentStep(prev)
  }, [currentStep, navigateForStep])

  return (
    <OnboardingContext.Provider value={{ startTour }}>
      {children}
      {active && isMobile && (
        <MobileWelcomeCard onDismiss={closeTour} />
      )}
      {(active || isClosing) && !isMobile && (
        <OnboardingTour
          steps={TOUR_STEPS}
          currentStep={currentStep}
          onNext={handleNext}
          onBack={handleBack}
          onSkip={closeTour}
          onDone={closeTour}
          isClosing={isClosing}
        />
      )}
    </OnboardingContext.Provider>
  )
}
