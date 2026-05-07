'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import * as Sentry from '@sentry/nextjs'
import posthog from 'posthog-js'
import { useAuth } from '@/contexts/AuthContext'
import { redactUrlForTelemetry } from '@/lib/safe-url'

function posthogConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_POSTHOG_TOKEN?.trim() && process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim(),
  )
}

export default function ObservabilityClient() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const lastPageviewUrlRef = useRef<string | null>(null)

  useEffect(() => {
    if (!posthogConfigured()) return
    const query = searchParams?.toString() ?? ''
    const pathWithQuery = query ? `${pathname}?${query}` : pathname
    if (!pathname) return
    const rawUrl =
      typeof window !== 'undefined' ? `${window.location.origin}${pathWithQuery}` : pathWithQuery
    const url = redactUrlForTelemetry(rawUrl)
    if (lastPageviewUrlRef.current === url) return
    lastPageviewUrlRef.current = url
    posthog.capture('$pageview', {
      $current_url: url,
    })
  }, [pathname, searchParams])

  useEffect(() => {
    if (!user) {
      Sentry.setUser(null)
      if (posthogConfigured()) {
        posthog.reset()
      }
      return
    }

    Sentry.setUser({
      id: user.id,
      email: user.email,
      username: [user.firstName, user.lastName].filter(Boolean).join(' ') || undefined,
    })

    if (!posthogConfigured()) return

    posthog.identify(user.id, {
      email: user.email,
      first_name: user.firstName ?? undefined,
      last_name: user.lastName ?? undefined,
    })
  }, [user])

  return null
}
