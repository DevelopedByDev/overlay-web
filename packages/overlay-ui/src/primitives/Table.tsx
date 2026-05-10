import * as React from 'react'
import { cn } from '../utils/cn'

export const Table = React.forwardRef<
  HTMLTableElement,
  React.TableHTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
  <table
    ref={ref}
    className={cn('w-full text-sm', className)}
    {...props}
  />
))
Table.displayName = 'Table'

export const TableHead = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead
    ref={ref}
    className={cn(
      'border-b border-[var(--border)] bg-[var(--surface-subtle)] text-left text-xs uppercase tracking-wide text-[var(--muted)]',
      className,
    )}
    {...props}
  />
))
TableHead.displayName = 'TableHead'

export const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn('divide-y divide-[var(--border)]', className)}
    {...props}
  />
))
TableBody.displayName = 'TableBody'

export const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn('transition-colors hover:bg-[var(--surface-subtle)]', className)}
    {...props}
  />
))
TableRow.displayName = 'TableRow'

export const TableHeader = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn('px-5 py-3 font-medium', className)}
    {...props}
  />
))
TableHeader.displayName = 'TableHeader'

export const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn('px-5 py-3', className)}
    {...props}
  />
))
TableCell.displayName = 'TableCell'
