import * as React from 'react'
import { cn } from '../utils/cn'

export interface ToggleProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  checked: boolean
  onChange: (checked: boolean) => void
}

export const Toggle = React.forwardRef<HTMLButtonElement, ToggleProps>(
  ({ className, checked, onChange, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors',
          checked
            ? 'border-[var(--foreground)] bg-[var(--foreground)]'
            : 'border-[var(--border)] bg-[var(--surface-subtle)]',
          className,
        )}
        {...props}
      >
        <span
          className={cn(
            'inline-block h-5 w-5 rounded-full bg-[var(--surface-elevated)] transition-transform',
            checked ? 'translate-x-6' : 'translate-x-1',
          )}
        />
      </button>
    )
  },
)
Toggle.displayName = 'Toggle'
