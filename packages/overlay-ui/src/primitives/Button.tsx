import * as React from 'react'
import { cn } from '../utils/cn'

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-xl font-medium transition-opacity focus:outline-none focus:ring-1 focus:ring-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-60',
          {
            'bg-[var(--foreground)] text-[var(--background)] hover:opacity-90':
              variant === 'primary',
            'border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--foreground)] hover:bg-[var(--surface-subtle)]':
              variant === 'secondary',
            'bg-transparent text-[var(--foreground)] hover:bg-[var(--surface-subtle)]':
              variant === 'ghost',
            'bg-red-500 text-white hover:bg-red-600': variant === 'danger',
          },
          {
            'h-7 px-2.5 text-xs': size === 'sm',
            'h-9 px-4 text-sm': size === 'md',
            'h-11 px-6 text-base': size === 'lg',
          },
          className,
        )}
        {...props}
      />
    )
  },
)
Button.displayName = 'Button'
