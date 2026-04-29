'use client'

import { ConvexReactClient } from 'convex/react'

const IS_DEV = process.env.NODE_ENV === 'development'

function resolveConvexUrl(): string {
  if (IS_DEV && process.env.DEV_NEXT_PUBLIC_CONVEX_URL) {
    return process.env.DEV_NEXT_PUBLIC_CONVEX_URL
  }
  if (IS_DEV && process.env.NEXT_PUBLIC_DEV_CONVEX_URL) {
    return process.env.NEXT_PUBLIC_DEV_CONVEX_URL
  }
  if (process.env.NEXT_PUBLIC_CONVEX_URL) {
    return process.env.NEXT_PUBLIC_CONVEX_URL
  }
  return ''
}

const convexUrl = resolveConvexUrl()

export const convexReactClient = new ConvexReactClient(convexUrl || 'https://missing-convex-url.convex.cloud')
