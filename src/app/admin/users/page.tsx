// @enterprise-future — not wired to production
// Admin Users page: list all users from Convex subscriptions

'use client'

import { useEffect, useState } from 'react'
import UserTable from '@/components/admin/UserTable'
import type { AdminUserRow } from '@/components/admin/UserTable'
import { Search } from 'lucide-react'

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUserRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch('/api/admin/users')
      .then(async (res) => {
        if (!res.ok) return { users: [] }
        return (await res.json()) as { users: AdminUserRow[] }
      })
      .then((data) => {
        setUsers(data.users)
      })
      .catch(() => setUsers([]))
      .finally(() => setIsLoading(false))
  }, [])

  const filtered = search.trim()
    ? users.filter(
        (u) =>
          u.email.toLowerCase().includes(search.toLowerCase()) ||
          (u.name ?? '').toLowerCase().includes(search.toLowerCase()),
      )
    : users

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            Users
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {users.length} total accounts
          </p>
        </div>
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
            strokeWidth={1.8}
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search users…"
            className="h-9 w-56 rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)] pl-9 pr-3 text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted)] focus:ring-1 focus:ring-[var(--foreground)]"
          />
        </div>
      </div>

      <UserTable users={filtered} isLoading={isLoading} />
    </div>
  )
}
