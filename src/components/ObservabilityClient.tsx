'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'
import { useAuth } from '@/contexts/AuthContext'

export default function ObservabilityClient() {
  const { user } = useAuth()

  useEffect(() => {
    if (!user) {
      Sentry.setUser(null)
      return
    }

    Sentry.setUser({
      id: user.id,
      email: user.email,
      username: [user.firstName, user.lastName].filter(Boolean).join(' ') || undefined,
    })
  }, [user])

  return null
}
