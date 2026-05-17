'use client'

import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'
import { Button, EmptyState, TabButton, TabsList, Toolbar, cn } from '@overlay/ui'

export interface ModulePageShellProps extends HTMLAttributes<HTMLElement> {
  sidebar?: ReactNode
  header?: ReactNode
  toolbar?: ReactNode
  emptyState?: ReactNode
}

export function ModulePageShell({
  sidebar,
  header,
  toolbar,
  emptyState,
  children,
  className,
  ...props
}: ModulePageShellProps) {
  return (
    <section
      className={cn('flex h-full min-h-0 bg-[var(--background)] text-[var(--foreground)]', className)}
      {...props}
    >
      {sidebar}
      <div className="flex min-w-0 flex-1 flex-col">
        {header}
        {toolbar}
        <div className="min-h-0 flex-1 overflow-auto">
          {children ?? emptyState ?? <EmptyState className="h-full" title="Nothing to show" />}
        </div>
      </div>
    </section>
  )
}

export interface ModuleHeaderProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
}

export function ModuleHeader({ title, description, actions, className, ...props }: ModuleHeaderProps) {
  return (
    <header
      className={cn(
        'flex min-h-14 shrink-0 items-center justify-between gap-3 border-b border-[var(--border)] px-4',
        className,
      )}
      {...props}
    >
      <div className="min-w-0">
        <h1 className="truncate text-sm font-semibold">{title}</h1>
        {description ? <p className="mt-0.5 truncate text-xs text-[var(--muted)]">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  )
}

export function ModuleToolbar({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <Toolbar className={cn('min-h-11', className)} {...props} />
}

export interface ModuleTabsProps {
  tabs: readonly { id: string; label: ReactNode; disabled?: boolean }[]
  activeTab: string
  onTabChange?: (tabId: string) => void
  className?: string
}

export function ModuleTabs({ tabs, activeTab, onTabChange, className }: ModuleTabsProps) {
  return (
    <TabsList className={className}>
      {tabs.map((tab) => (
        <TabButton
          key={tab.id}
          active={tab.id === activeTab}
          disabled={tab.disabled}
          onClick={() => onTabChange?.(tab.id)}
        >
          {tab.label}
        </TabButton>
      ))}
    </TabsList>
  )
}

export interface BulkActionBarProps extends HTMLAttributes<HTMLDivElement> {
  selectedCount: number
  onClear?: () => void
  actions?: ReactNode
}

export function BulkActionBar({ selectedCount, onClear, actions, className, ...props }: BulkActionBarProps) {
  if (selectedCount <= 0) return null
  return (
    <div
      className={cn(
        'flex min-h-11 items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface-subtle)] px-4 text-xs text-[var(--muted)]',
        className,
      )}
      {...props}
    >
      <span>{selectedCount} selected</span>
      <div className="flex items-center gap-2">
        {actions}
        {onClear ? (
          <Button size="sm" variant="ghost" onClick={onClear}>
            Clear
          </Button>
        ) : null}
      </div>
    </div>
  )
}

export interface InlineRenameFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onCancel' | 'onSubmit'> {
  onCancel?: () => void
  onSubmit?: (value: string) => void
}

export function InlineRenameField({
  value,
  onCancel,
  onSubmit,
  className,
  ...props
}: InlineRenameFieldProps) {
  return (
    <input
      value={value}
      className={cn(
        'min-w-0 rounded-md border border-[var(--border)] bg-[var(--surface-elevated)] px-2 py-1 text-sm text-[var(--foreground)] outline-none',
        className,
      )}
      onKeyDown={(event) => {
        props.onKeyDown?.(event)
        if (event.defaultPrevented) return
        if (event.key === 'Enter') onSubmit?.(String(value ?? ''))
        if (event.key === 'Escape') onCancel?.()
      }}
      {...props}
    />
  )
}

export interface StatusBannerProps extends HTMLAttributes<HTMLDivElement> {
  tone?: 'info' | 'success' | 'warning' | 'danger'
}

const statusToneClass = {
  info: 'border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--muted)]',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-700',
  danger: 'border-red-200 bg-red-50 text-red-600',
} as const

export function StatusBanner({ tone = 'info', className, ...props }: StatusBannerProps) {
  return (
    <div
      className={cn('rounded-lg border px-3 py-2 text-sm', statusToneClass[tone], className)}
      {...props}
    />
  )
}

export interface ResourceListProps<T> {
  items: readonly T[]
  getKey: (item: T) => string
  renderItem: (item: T) => ReactNode
  loading?: boolean
  emptyTitle?: ReactNode
  className?: string
}

export function ResourceList<T>({
  items,
  getKey,
  renderItem,
  loading,
  emptyTitle = 'No resources yet',
  className,
}: ResourceListProps<T>) {
  if (loading) return <DataState label="Loading..." />
  if (items.length === 0) return <EmptyState className="h-full min-h-48" title={emptyTitle} />
  return <div className={cn('divide-y divide-[var(--border)]', className)}>{items.map((item) => <div key={getKey(item)}>{renderItem(item)}</div>)}</div>
}

export interface DataStateProps extends HTMLAttributes<HTMLDivElement> {
  label: ReactNode
}

export function DataState({ label, className, ...props }: DataStateProps) {
  return <div className={cn('p-4 text-xs text-[var(--muted)]', className)} {...props}>{label}</div>
}

export type ToolbarButtonProps = ButtonHTMLAttributes<HTMLButtonElement>
