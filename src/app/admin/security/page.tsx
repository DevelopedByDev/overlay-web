// @enterprise-future — not wired to production
// Admin Security page: audit log viewer

'use client'

import { useEffect, useState } from 'react'
import AuditLogTable from '@/components/admin/AuditLogTable'
import type { AuditEvent } from '@/lib/audit'

export default function AdminSecurityPage() {
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/audit')
      .then(async (res) => {
        if (!res.ok) return { events: [] }
        return (await res.json()) as { events: AuditEvent[] }
      })
      .then((data) => setEvents(data.events))
      .catch(() => setEvents([]))
      .finally(() => setIsLoading(false))
  }, [])

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[var(--foreground)]">
          Security
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Audit log of admin actions and system events
        </p>
      </div>

      <AuditLogTable events={events} isLoading={isLoading} />
    </div>
  )
}
