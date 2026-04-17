'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import * as Sentry from '@sentry/nextjs'
import mixpanel from 'mixpanel-browser'
import { useAuth } from '@/contexts/AuthContext'

let mixpanelInitialized = false

function getMixpanelToken(): string | null {
  const token = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN?.trim()
  return token && token.length > 0 ? token : null
}

export default function ObservabilityClient() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const lastTrackedUrlRef = useRef<string | null>(null)

  useEffect(() => {
    const token = getMixpanelToken()
    if (!token || mixpanelInitialized) return

    mixpanel.init(token, {
      api_host: process.env.NEXT_PUBLIC_MIXPANEL_API_HOST || undefined,
      autocapture: false,
      persistence: 'localStorage',
      track_pageview: false,
      debug: process.env.NODE_ENV === 'development',
    })
    mixpanelInitialized = true
  }, [])

  useEffect(() => {
    const token = getMixpanelToken()
    if (!token || !pathname || !mixpanelInitialized) return

    const query = searchParams?.toString() ?? ''
    const url = query ? `${pathname}?${query}` : pathname
    if (lastTrackedUrlRef.current === url) return
    lastTrackedUrlRef.current = url

    mixpanel.track('page_view', {
      path: pathname,
      query: query || undefined,
      url,
    })
  }, [pathname, searchParams])

  useEffect(() => {
    if (!user) {
      Sentry.setUser(null)
      if (mixpanelInitialized) {
        mixpanel.reset()
      }
      return
    }

    Sentry.setUser({
      id: user.id,
      email: user.email,
      username: [user.firstName, user.lastName].filter(Boolean).join(' ') || undefined,
    })

    if (!mixpanelInitialized) return

    mixpanel.identify(user.id)
    mixpanel.people.set({
      $email: user.email,
      $first_name: user.firstName,
      $last_name: user.lastName,
    })
  }, [user])

  return null
}
