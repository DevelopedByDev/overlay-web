import * as React from 'react'
import { cn } from '../utils/cn'
import { ChevronDown } from 'lucide-react'

export interface SelectOption {
  value: string
  label: string
}

export interface SelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  options: SelectOption[]
  onChange?: (value: string) => void
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, options, onChange, ...props }, ref) => {
    return (
      <div className="relative">
        <select
          ref={ref}
          className={cn(
            'h-9 w-full appearance-none rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)] pl-3 pr-8 text-sm text-[var(--foreground)] outline-none transition-colors focus:ring-1 focus:ring-[var(--foreground)] disabled:opacity-60',
            className,
          )}
          onChange={(e) => onChange?.(e.target.value)}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={14}
          className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)]"
          strokeWidth={1.8}
        />
      </div>
    )
  },
)
Select.displayName = 'Select'
