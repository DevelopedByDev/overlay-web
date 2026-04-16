'use client'

import React from 'react'
import { parseOpenUILang, resolveArg } from '@/lib/openui-parser'
import type { OpenUINode, OpenUIDefinitions, OpenUIArg } from '@/lib/openui-parser'

// ─── Component Renderers ────────────────────────────────────────────────────

function RenderStack({ node, defs }: { node: OpenUINode; defs: OpenUIDefinitions }) {
  const children = resolveChildren(node.args[0], defs)
  return (
    <div className="flex flex-col gap-3">
      {children}
    </div>
  )
}

function RenderGrid({ node, defs }: { node: OpenUINode; defs: OpenUIDefinitions }) {
  const children = resolveChildren(node.args[0], defs)
  const count = React.Children.count(children)
  const colClass = count <= 2 ? 'grid-cols-2' : count === 3 ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-4'
  return (
    <div className={`grid gap-3 ${colClass}`}>
      {children}
    </div>
  )
}

function RenderCard({ node }: { node: OpenUINode }) {
  const headline = argStr(node.args[0])
  const body = argStr(node.args[1])
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-4 shadow-sm">
      {headline && <p className="text-sm font-semibold text-[var(--foreground)]">{headline}</p>}
      {body && <p className="mt-1.5 text-sm leading-relaxed text-[var(--muted)]">{body}</p>}
    </div>
  )
}

function RenderStatCard({ node }: { node: OpenUINode }) {
  const label = argStr(node.args[0])
  const value = argStr(node.args[1])
  const trend = argStr(node.args[2])

  const trendEl = trend ? (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-medium ${
        trend === 'up'
          ? 'text-emerald-600 dark:text-emerald-400'
          : trend === 'down'
          ? 'text-red-600 dark:text-red-400'
          : 'text-[var(--muted)]'
      }`}
    >
      {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}
      <span className="capitalize">{trend}</span>
    </span>
  ) : null

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-2xl font-bold text-[var(--foreground)] leading-tight">{value}</p>
      {trendEl && <div className="mt-1.5">{trendEl}</div>}
    </div>
  )
}

function RenderDataTable({ node, defs }: { node: OpenUINode; defs: OpenUIDefinitions }) {
  const columnsStr = argStr(node.args[0])
  const columns = columnsStr ? columnsStr.split(',').map((c) => c.trim()) : []
  const rowRefs = node.args[1]
  const rows: string[][] = []

  if (Array.isArray(rowRefs)) {
    for (const ref of rowRefs) {
      if (typeof ref === 'string') {
        const rowNode = defs.get(ref)
        if (rowNode?.component === 'DataRow') {
          const valStr = argStr(rowNode.args[0])
          rows.push(valStr ? valStr.split(',').map((v) => v.trim()) : [])
        }
      }
    }
  }

  if (columns.length === 0) return null

  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] bg-[var(--surface-subtle)]">
            {columns.map((col, i) => (
              <th
                key={i}
                className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--muted)]"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr
              key={ri}
              className={`border-b border-[var(--border)] last:border-0 ${ri % 2 === 1 ? 'bg-[var(--surface-subtle)]' : ''}`}
            >
              {columns.map((_, ci) => (
                <td key={ci} className="px-4 py-2.5 text-[var(--foreground)]">
                  {row[ci] ?? ''}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function RenderBadge({ node }: { node: OpenUINode }) {
  const label = argStr(node.args[0])
  const variant = argStr(node.args[1]) || 'default'

  const variantClass: Record<string, string> = {
    default: 'bg-[var(--surface-subtle)] text-[var(--foreground)]',
    success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    error: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    info: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  }

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${variantClass[variant] ?? variantClass.default}`}
    >
      {label}
    </span>
  )
}

function RenderAlert({ node }: { node: OpenUINode }) {
  const type = argStr(node.args[0]) || 'info'
  const message = argStr(node.args[1])
  const title = argStr(node.args[2])

  const typeStyles: Record<string, { container: string; icon: string }> = {
    info: {
      container: 'border-blue-200 bg-blue-50 dark:border-blue-800/50 dark:bg-blue-900/20',
      icon: 'text-blue-600 dark:text-blue-400',
    },
    success: {
      container: 'border-emerald-200 bg-emerald-50 dark:border-emerald-800/50 dark:bg-emerald-900/20',
      icon: 'text-emerald-600 dark:text-emerald-400',
    },
    warning: {
      container: 'border-amber-200 bg-amber-50 dark:border-amber-800/50 dark:bg-amber-900/20',
      icon: 'text-amber-600 dark:text-amber-400',
    },
    error: {
      container: 'border-red-200 bg-red-50 dark:border-red-800/50 dark:bg-red-900/20',
      icon: 'text-red-600 dark:text-red-400',
    },
  }
  const s = typeStyles[type] ?? typeStyles.info

  const icons: Record<string, string> = {
    info: 'ℹ',
    success: '✓',
    warning: '⚠',
    error: '✕',
  }

  return (
    <div className={`rounded-xl border p-4 ${s.container}`}>
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 text-base font-bold shrink-0 ${s.icon}`}>{icons[type] ?? 'ℹ'}</span>
        <div className="min-w-0">
          {title && <p className={`text-sm font-semibold mb-0.5 ${s.icon}`}>{title}</p>}
          <p className="text-sm text-[var(--foreground)] leading-relaxed">{message}</p>
        </div>
      </div>
    </div>
  )
}

function RenderKeyValueList({ node, defs }: { node: OpenUINode; defs: OpenUIDefinitions }) {
  const pairRefs = node.args[0]
  const pairs: { label: string; value: string }[] = []

  if (Array.isArray(pairRefs)) {
    for (const ref of pairRefs) {
      if (typeof ref === 'string') {
        const pNode = defs.get(ref)
        if (pNode?.component === 'KeyValuePair') {
          pairs.push({
            label: argStr(pNode.args[0]) ?? '',
            value: argStr(pNode.args[1]) ?? '',
          })
        }
      }
    }
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] shadow-sm overflow-hidden">
      {pairs.map((pair, i) => (
        <div
          key={i}
          className={`flex items-center justify-between px-4 py-2.5 ${
            i < pairs.length - 1 ? 'border-b border-[var(--border)]' : ''
          } ${i % 2 === 1 ? 'bg-[var(--surface-subtle)]' : ''}`}
        >
          <span className="text-sm text-[var(--muted)] shrink-0 mr-4">{pair.label}</span>
          <span className="text-sm font-medium text-[var(--foreground)] text-right">{pair.value}</span>
        </div>
      ))}
    </div>
  )
}

function RenderTextContent({ node }: { node: OpenUINode }) {
  const text = argStr(node.args[0])
  const style = argStr(node.args[1]) || 'normal'

  const styleClass: Record<string, string> = {
    heading: 'text-base font-bold text-[var(--foreground)]',
    subheading: 'text-sm font-semibold text-[var(--foreground)]',
    muted: 'text-sm text-[var(--muted)]',
    normal: 'text-sm text-[var(--foreground)]',
  }

  return <p className={styleClass[style] ?? styleClass.normal}>{text}</p>
}

function RenderSection({ node, defs }: { node: OpenUINode; defs: OpenUIDefinitions }) {
  const title = argStr(node.args[0])
  const children = resolveChildren(node.args[1], defs)
  return (
    <div className="flex flex-col gap-3">
      {title && (
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">{title}</p>
      )}
      {children}
    </div>
  )
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function argStr(arg: OpenUIArg | undefined): string | null {
  if (typeof arg === 'string') return arg
  return null
}

function resolveChildren(arg: OpenUIArg | undefined, defs: OpenUIDefinitions): React.ReactNode[] {
  if (!arg) return []
  if (!Array.isArray(arg)) return []

  return arg.map((ref, i) => {
    if (typeof ref !== 'string') return null
    const node = defs.get(ref)
    if (!node) return null
    return <RenderNode key={`${ref}-${i}`} node={node} defs={defs} />
  })
}

function RenderNode({ node, defs }: { node: OpenUINode; defs: OpenUIDefinitions }): React.ReactElement | null {
  switch (node.component) {
    case 'Stack': return <RenderStack node={node} defs={defs} />
    case 'Grid': return <RenderGrid node={node} defs={defs} />
    case 'Card': return <RenderCard node={node} />
    case 'StatCard': return <RenderStatCard node={node} />
    case 'DataTable': return <RenderDataTable node={node} defs={defs} />
    case 'DataRow': return null // rendered via DataTable
    case 'Badge': return <RenderBadge node={node} />
    case 'Alert': return <RenderAlert node={node} />
    case 'KeyValueList': return <RenderKeyValueList node={node} defs={defs} />
    case 'KeyValuePair': return null // rendered via KeyValueList
    case 'TextContent': return <RenderTextContent node={node} />
    case 'Section': return <RenderSection node={node} defs={defs} />
    default: return null
  }
}

// ─── Public Component ────────────────────────────────────────────────────────

interface OpenUIRendererProps {
  code: string
}

export function OpenUIRenderer({ code }: OpenUIRendererProps) {
  const parsed = parseOpenUILang(code)

  if (!parsed) {
    // Fallback: show as plain code if parsing fails
    return (
      <pre className="rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] p-4 text-xs font-mono text-[var(--muted)] overflow-x-auto">
        {code}
      </pre>
    )
  }

  return (
    <div className="my-2 flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface-subtle)] px-2 py-0.5 text-[10px] font-medium text-[var(--muted)]">
          <span className="text-[9px]">✦</span>
          Generated UI
        </span>
      </div>
      <div className="min-w-0">
        <RenderNode node={parsed.root} defs={parsed.defs} />
      </div>
    </div>
  )
}
