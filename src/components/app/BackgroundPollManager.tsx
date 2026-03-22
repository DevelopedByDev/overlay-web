'use client'

import { useEffect, useRef } from 'react'
import { useAsyncSessions } from '@/lib/async-sessions-store'

export default function BackgroundPollManager() {
  const { sessions, completeSession, activeViewerIds } = useAsyncSessions()
  const sessionsRef = useRef(sessions)
  const completeSessionRef = useRef(completeSession)
  const activeViewerIdsRef = useRef(activeViewerIds)

  useEffect(() => { sessionsRef.current = sessions }, [sessions])
  useEffect(() => { completeSessionRef.current = completeSession }, [completeSession])
  useEffect(() => { activeViewerIdsRef.current = activeViewerIds }, [activeViewerIds])

  useEffect(() => {
    const interval = setInterval(async () => {
      const pending = Object.values(sessionsRef.current).filter((s) => s.status === 'streaming')
      if (pending.length === 0) return

      await Promise.all(
        pending.map(async (session) => {
          try {
            const url = `/api/app/conversations?conversationId=${session.id}&messages=true`
            const res = await fetch(url)
            if (!res.ok) return
            const data = await res.json()
            const messages: unknown[] = data.messages || []
            if (messages.length > session.messageCountAtStart + 1) {
              const currentViewer = activeViewerIdsRef.current.conversation
              completeSessionRef.current(session.id, currentViewer === session.id)
            }
          } catch {
            // ignore transient errors
          }
        })
      )
    }, 5000)

    return () => clearInterval(interval)
  }, [])

  return null
}
