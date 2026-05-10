'use client'

import RoleBadge from './RoleBadge'

export interface AdminUserRow {
  id: string
  email: string
  name?: string
  tier: string
  lastLoginAt?: number
  role: 'admin' | 'user'
}

export default function UserTable({
  users,
  isLoading,
}: {
  users: AdminUserRow[]
  isLoading?: boolean
}) {
  if (isLoading) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-8">
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-10 animate-pulse rounded-lg bg-[var(--surface-subtle)]"
            />
          ))}
        </div>
      </div>
    )
  }

  if (users.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-8 text-center text-sm text-[var(--muted)]">
        No users found.
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] bg-[var(--surface-subtle)] text-left text-xs uppercase tracking-wide text-[var(--muted)]">
            <th className="px-5 py-3 font-medium">Name</th>
            <th className="px-5 py-3 font-medium">Email</th>
            <th className="px-5 py-3 font-medium">Tier</th>
            <th className="px-5 py-3 font-medium">Role</th>
            <th className="px-5 py-3 font-medium">Last login</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">
          {users.map((u) => (
            <tr
              key={u.id}
              className="transition-colors hover:bg-[var(--surface-subtle)]"
            >
              <td className="px-5 py-3 text-[var(--foreground)]">
                {u.name || '—'}
              </td>
              <td className="px-5 py-3 text-[var(--foreground)]">{u.email}</td>
              <td className="px-5 py-3">
                <span className="inline-flex items-center rounded-full bg-[var(--surface-subtle)] px-2 py-0.5 text-xs font-medium text-[var(--muted)]">
                  {u.tier}
                </span>
              </td>
              <td className="px-5 py-3">
                <RoleBadge role={u.role} />
              </td>
              <td className="px-5 py-3 text-[var(--muted)]">
                {u.lastLoginAt
                  ? new Date(u.lastLoginAt).toLocaleDateString()
                  : 'Never'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
