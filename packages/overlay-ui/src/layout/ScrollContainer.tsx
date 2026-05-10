import * as React from 'react'
import { cn } from '../utils/cn'

export const ScrollContainer = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('overflow-auto', className)}
    {...props}
  />
))
ScrollContainer.displayName = 'ScrollContainer'
