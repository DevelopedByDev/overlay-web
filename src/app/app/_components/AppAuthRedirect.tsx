'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export function AppAuthRedirect({ href = '/app/projects?signin=nav' }: { href?: string }) {
  const router = useRouter()

  useEffect(() => {
    router.replace(href)
  }, [href, router])

  return null
}
