export default function RoleBadge({ role }: { role: 'admin' | 'user' }) {
  const isAdmin = role === 'admin'
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
        isAdmin
          ? 'bg-amber-100 text-amber-800'
          : 'bg-[var(--surface-subtle)] text-[var(--muted)]'
      }`}
    >
      {isAdmin ? 'Admin' : 'User'}
    </span>
  )
}
