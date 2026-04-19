'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { useSearchParams } from 'next/navigation'
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

export function GuestGateProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  const searchParams = useSearchParams()
  const [modalReason, setModalReason] = useState<GateReason | null>(null)
  const [cornerDismissed, setCornerDismissed] = useState(true)

  useEffect(() => {
    // eslint-disable-next-line react-compiler/react-compiler
    setCornerDismissed(readCornerDismissed())
  }, [])

  useEffect(() => {
    if (!isLoading && !isAuthenticated && searchParams?.get('signin') === 'nav') {
      // eslint-disable-next-line react-compiler/react-compiler
      setModalReason('nav')
    }
  }, [isLoading, isAuthenticated, searchParams])

  const requireAuth = useCallback(
    (reason: GateReason) => {
      if (!isLoading && !isAuthenticated) setModalReason(reason)
    },
    [isLoading, isAuthenticated],
  )

  const closeModal = useCallback(() => setModalReason(null), [])

  const dismissCorner = useCallback(() => {
    try {
      sessionStorage.setItem(CORNER_DISMISSED_KEY, '1')
    } catch {
      // ignore
    }
    setCornerDismissed(true)
  }, [])

  const showCorner =
    !isLoading && !isAuthenticated && !cornerDismissed && !modalReason

  return (
    <GuestGateContext.Provider value={{ requireAuth, isModalOpen: !!modalReason }}>
      {children}
      {!isLoading && !isAuthenticated && modalReason && (
        <SignInFullScreenModal reason={modalReason} onClose={closeModal} />
      )}
      {showCorner && (
        <SignInCornerPopover onDismiss={dismissCorner} />
      )}
    </GuestGateContext.Provider>
  )
}

export function useGuestGate(): GuestGateContextType {
  const ctx = useContext(GuestGateContext)
  if (!ctx) throw new Error('useGuestGate must be used within GuestGateProvider')
  return ctx
}
