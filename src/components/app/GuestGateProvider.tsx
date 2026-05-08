'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { SignInFullScreenModal } from './SignInFullScreenModal'
import { SignInCornerPopover } from './SignInCornerPopover'

export type GateReason = 'send' | 'nav' | 'history' | 'settings'

interface GuestGateContextType {
  requireAuth: (reason: GateReason) => void
  isModalOpen: boolean
}

const GuestGateContext = createContext<GuestGateContextType | undefined>(undefined)

const CORNER_DISMISSED_KEY = 'overlay:corner-dismissed'

function readCornerDismissed(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return sessionStorage.getItem(CORNER_DISMISSED_KEY) === '1'
  } catch {
    return false
  }
}

const FADE_MS = 200

export function GuestGateProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  const pathname = usePathname()
  const [modalReason, setModalReason] = useState<GateReason | null>(null)
  const [modalClosing, setModalClosing] = useState(false)
  const [cornerDismissed, setCornerDismissed] = useState(readCornerDismissed)
  const [cornerClosing, setCornerClosing] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (!isLoading && !isAuthenticated && params.get('signin') === 'nav') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setModalReason('nav')
    }
  }, [isLoading, isAuthenticated, pathname])

  const requireAuth = useCallback(
    (reason: GateReason) => {
      if (!isLoading && !isAuthenticated) setModalReason(reason)
    },
    [isLoading, isAuthenticated],
  )

  const closeModal = useCallback(() => {
    setModalClosing(true)
    setTimeout(() => {
      setModalReason(null)
      setModalClosing(false)
    }, FADE_MS)
  }, [])

  const dismissCorner = useCallback(() => {
    setCornerClosing(true)
    setTimeout(() => {
      try { sessionStorage.setItem(CORNER_DISMISSED_KEY, '1') } catch { /* ignore */ }
      setCornerDismissed(true)
      setCornerClosing(false)
    }, FADE_MS)
  }, [])

  const showCorner =
    !isLoading && !isAuthenticated && !cornerDismissed && !modalReason

  return (
    <GuestGateContext.Provider value={{ requireAuth, isModalOpen: !!modalReason }}>
      {children}
      {!isAuthenticated && (((!isLoading && !!modalReason) || modalClosing)) ? (
        <SignInFullScreenModal
          reason={modalReason ?? 'nav'}
          onClose={closeModal}
          isClosing={modalClosing}
        />
      ) : null}
      {(showCorner || cornerClosing) ? (
        <SignInCornerPopover onDismiss={dismissCorner} isClosing={cornerClosing} />
      ) : null}
    </GuestGateContext.Provider>
  )
}

export function useGuestGate(): GuestGateContextType {
  const ctx = useContext(GuestGateContext)
  if (!ctx) throw new Error('useGuestGate must be used within GuestGateProvider')
  return ctx
}
