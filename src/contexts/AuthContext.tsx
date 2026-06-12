'use client'

import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react'

export interface AuthUser {
  id: string
  email: string
  firstName?: string
  lastName?: string
  profilePictureUrl?: string
  emailVerified?: boolean
}

interface AuthContextType {
  user: AuthUser | null
  isLoading: boolean
  isAuthenticated: boolean
  signOut: () => Promise<void>
  refreshSession: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

type AuthProviderProps = {
  children: ReactNode
  initialUser?: AuthUser | null
  initialSessionResolved?: boolean
}

export function AuthProvider({
  children,
  initialUser = null,
  initialSessionResolved = false,
}: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(initialUser)
  const [isLoading, setIsLoading] = useState(!initialSessionResolved)
  const trustedServerUserRef = useRef(initialUser)

  useEffect(() => {
    trustedServerUserRef.current = initialUser
    if (initialSessionResolved) {
      setUser(initialUser)
      setIsLoading(false)
    }
  }, [initialUser, initialSessionResolved])

  const checkSession = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/session', {
        credentials: 'same-origin',
        cache: 'no-store',
      })
      const contentType = response.headers.get('content-type') || ''
      if (!response.ok || !contentType.includes('application/json')) {
        if (!trustedServerUserRef.current) {
          setUser(null)
        }
        return
      }
      const data = await response.json()
      
      if (data.authenticated && data.user) {
        setUser(data.user)
      } else if (!trustedServerUserRef.current) {
        setUser(null)
      }
    } catch (error) {
      console.error('[Auth] Session check failed:', error)
      if (!trustedServerUserRef.current) {
        setUser(null)
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  const signOut = useCallback(async () => {
    try {
      try {
        const { default: posthog } = await import('posthog-js')
        posthog.capture('user_signed_out')
      } catch {
        // ignore
      }
      await fetch('/api/auth/sign-out', { method: 'POST' })
      try {
        const { default: posthog } = await import('posthog-js')
        posthog.reset()
      } catch {
        // ignore
      }
      setUser(null)
      window.location.href = '/'
    } catch (error) {
      console.error('[Auth] Sign out failed:', error)
    }
  }, [])

  const refreshSession = useCallback(async () => {
    await checkSession()
  }, [checkSession])

  useEffect(() => {
    void checkSession()
  }, [checkSession])

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        signOut,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function AuthBoundary(props: AuthProviderProps) {
  const context = useContext(AuthContext)
  if (context !== undefined) return props.children
  return <AuthProvider {...props} />
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
