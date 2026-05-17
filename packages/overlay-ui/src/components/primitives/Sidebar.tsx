import type { HTMLAttributes } from 'react'
import { cn } from '../../utils/cn'

export function SidebarShell({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <aside
      className={cn(
        'flex h-full shrink-0 flex-col border-r border-[var(--border)] bg-[var(--sidebar-surface)]',
        className,
      )}
      {...props}
    />
  )
}

export function SidebarSection({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('border-t border-[var(--border)] px-2 py-3', className)} {...props} />
}

export function SidebarNav({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <nav className={cn('space-y-0.5 px-2 py-3', className)} {...props} />
}
