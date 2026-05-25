'use client'

import { useEffect, useState, type ComponentType } from 'react'

export default function AgentationDev() {
  const [Agentation, setAgentation] = useState<ComponentType | null>(null)

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return
    let cancelled = false
    void import('agentation').then((mod) => {
      if (!cancelled) setAgentation(() => mod.Agentation)
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (process.env.NODE_ENV !== 'development') return null
  if (!Agentation) return null
  return <Agentation />
}
