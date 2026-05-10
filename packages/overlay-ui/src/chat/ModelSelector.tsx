import * as React from 'react'
import { cn } from '../utils/cn'

export interface ModelOption {
  id: string
  name: string
}

export interface ModelSelectorProps {
  models: ModelOption[]
  value: string
  onChange: (id: string) => void
  disabled?: boolean
  className?: string
}

export function ModelSelector({
  models,
  value,
  onChange,
  disabled,
  className,
}: ModelSelectorProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={cn(
        'h-8 rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)] px-2.5 text-xs font-medium text-[var(--foreground)] outline-none focus:ring-1 focus:ring-[var(--foreground)] disabled:opacity-60',
        className,
      )}
    >
      {models.map((m) => (
        <option key={m.id} value={m.id}>
          {m.name}
        </option>
      ))}
    </select>
  )
}
