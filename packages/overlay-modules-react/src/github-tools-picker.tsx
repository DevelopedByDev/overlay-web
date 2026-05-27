'use client'

import { useMemo, useState } from 'react'
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronRight,
  Loader2,
  Lock,
  Minus,
} from 'lucide-react'
import type { GithubToolInfo } from '@overlay/app-core'

export interface GithubToolsPickerProps {
  /** Currently enabled slugs (controlled). */
  value: readonly string[]
  /** Full catalog of available tools, server-grouped by category in `info.category`. */
  options: readonly GithubToolInfo[]
  /** Server-side defaults — what "Reset to defaults" writes. */
  defaultEnabled: readonly string[]
  /** Slugs blocked by server policy — rendered disabled with a tooltip. */
  hardDenied: readonly string[]
  loading: boolean
  error: 'github_not_connected' | 'fetch_failed' | 'rate_limited' | null
  /** True when the last save round-trip failed; the parent surfaces this to give the user retry feedback. */
  saveError: boolean
  /** Fires on every toggle / quick-action with the new enabled set. */
  onChange: (next: readonly string[]) => void
  onRetryLoad: () => void
  /** Dismiss handler for the save-error banner; clears the error in the parent. */
  onDismissSaveError: () => void
}

/**
 * Canonical category order used to render groups. Categories not in this list
 * (server-side category drift) are rendered last, alphabetically.
 */
const CATEGORY_ORDER: readonly string[] = [
  'Repositories',
  'Issues',
  'Pull Requests',
  'Comments',
  'Commits & Refs',
  'Workflows & Actions',
  'Releases',
  'Collaboration',
  'Content & Search',
  'User & Org',
  'Other',
] as const

// ---------------------------------------------------------------------------
// Pure helpers (exported for unit tests).
// ---------------------------------------------------------------------------

/**
 * Add `slug` if missing, remove if present. Returns a new array; never mutates.
 */
export function toggleSlugInList(
  list: readonly string[],
  slug: string,
): readonly string[] {
  return list.includes(slug) ? list.filter((s) => s !== slug) : [...list, slug]
}

/**
 * Order-insensitive equality for slug lists.
 */
export function equalSlugSets(
  a: readonly string[],
  b: readonly string[],
): boolean {
  if (a.length !== b.length) return false
  const setA = new Set(a)
  for (const slug of b) {
    if (!setA.has(slug)) return false
  }
  return true
}

/**
 * Returns the non-hard-denied tool slugs in a given category.
 */
function toggleableSlugsInCategory(
  category: string,
  options: readonly GithubToolInfo[],
  hardDenied: readonly string[],
): string[] {
  const blocked = new Set(hardDenied)
  return options
    .filter((info) => info.category === category && !blocked.has(info.slug))
    .map((info) => info.slug)
}

/**
 * Group select-all toggle: if not all non-hard-denied tools in the category
 * are enabled, enable the missing ones; otherwise disable all of them.
 * Hard-denied tools are never touched.
 */
export function toggleCategoryGroup(
  value: readonly string[],
  category: string,
  options: readonly GithubToolInfo[],
  hardDenied: readonly string[],
): readonly string[] {
  const toggleable = toggleableSlugsInCategory(category, options, hardDenied)
  if (toggleable.length === 0) return value

  const enabledSet = new Set(value)
  const allEnabled = toggleable.every((slug) => enabledSet.has(slug))

  if (allEnabled) {
    // Disable all toggleable in this category.
    const removeSet = new Set(toggleable)
    return value.filter((slug) => !removeSet.has(slug))
  }
  // Enable all missing toggleable; keep current order, then append new ones.
  const next = [...value]
  for (const slug of toggleable) {
    if (!enabledSet.has(slug)) next.push(slug)
  }
  return next
}

/**
 * True when some-but-not-all non-hard-denied tools in this category are
 * enabled. Used to render the indeterminate state on the group checkbox.
 */
export function isCategoryIndeterminate(
  value: readonly string[],
  category: string,
  options: readonly GithubToolInfo[],
  hardDenied: readonly string[],
): boolean {
  const toggleable = toggleableSlugsInCategory(category, options, hardDenied)
  if (toggleable.length === 0) return false
  const enabledSet = new Set(value)
  let enabledCount = 0
  for (const slug of toggleable) {
    if (enabledSet.has(slug)) enabledCount += 1
  }
  return enabledCount > 0 && enabledCount < toggleable.length
}

/**
 * True when every non-hard-denied tool in the category is enabled.
 */
export function isCategoryAllEnabled(
  value: readonly string[],
  category: string,
  options: readonly GithubToolInfo[],
  hardDenied: readonly string[],
): boolean {
  const toggleable = toggleableSlugsInCategory(category, options, hardDenied)
  if (toggleable.length === 0) return false
  const enabledSet = new Set(value)
  return toggleable.every((slug) => enabledSet.has(slug))
}

/**
 * Stable category ordering. Anything outside CATEGORY_ORDER (server drift) is
 * appended alphabetically at the end so we never silently drop categories.
 */
function orderedCategoriesWithItems(
  options: readonly GithubToolInfo[],
): string[] {
  const seen = new Map<string, true>()
  for (const info of options) {
    if (!seen.has(info.category)) seen.set(info.category, true)
  }
  const ordered: string[] = []
  for (const category of CATEGORY_ORDER) {
    if (seen.has(category)) {
      ordered.push(category)
      seen.delete(category)
    }
  }
  const extras = Array.from(seen.keys()).sort()
  return [...ordered, ...extras]
}

// ---------------------------------------------------------------------------
// Component.
// ---------------------------------------------------------------------------

interface CategoryBuckets {
  category: string
  items: GithubToolInfo[]
  enabledCount: number
  toggleableTotal: number
  hasEnabled: boolean
}

export function GithubToolsPicker({
  value,
  options,
  defaultEnabled,
  hardDenied,
  loading,
  error,
  saveError,
  onChange,
  onRetryLoad,
  onDismissSaveError,
}: GithubToolsPickerProps) {
  const enabledSet = useMemo(() => new Set(value), [value])
  const hardDeniedSet = useMemo(() => new Set(hardDenied), [hardDenied])

  const buckets: CategoryBuckets[] = useMemo(() => {
    const grouped = new Map<string, GithubToolInfo[]>()
    for (const info of options) {
      const list = grouped.get(info.category)
      if (list) {
        list.push(info)
      } else {
        grouped.set(info.category, [info])
      }
    }
    const ordered = orderedCategoriesWithItems(options)
    return ordered
      .map((category) => {
        const items = grouped.get(category) ?? []
        let enabledCount = 0
        let toggleableTotal = 0
        let hasEnabled = false
        for (const info of items) {
          const isDenied = hardDeniedSet.has(info.slug)
          if (!isDenied) toggleableTotal += 1
          if (enabledSet.has(info.slug)) {
            enabledCount += 1
            hasEnabled = true
          }
        }
        return { category, items, enabledCount, toggleableTotal, hasEnabled }
      })
      .filter((bucket) => bucket.items.length > 0)
  }, [options, enabledSet, hardDeniedSet])

  // Categories with anything enabled open by default; user can collapse manually.
  const initialOpen = useMemo(() => {
    const open: Record<string, boolean> = {}
    for (const bucket of buckets) {
      if (bucket.hasEnabled) open[bucket.category] = true
    }
    return open
  }, [buckets])

  const [openOverrides, setOpenOverrides] = useState<Record<string, boolean>>({})

  function isOpen(category: string): boolean {
    if (Object.prototype.hasOwnProperty.call(openOverrides, category)) {
      return openOverrides[category] === true
    }
    return initialOpen[category] === true
  }

  function setOpen(category: string, next: boolean) {
    setOpenOverrides((prev) => ({ ...prev, [category]: next }))
  }

  const totalToggleable = options.length - hardDeniedSet.size
  const resetDisabled = equalSlugSets(value, defaultEnabled)
  const disableAllDisabled = value.length === 0

  function handleToggleTool(slug: string) {
    if (hardDeniedSet.has(slug)) return
    onChange(toggleSlugInList(value, slug))
  }

  function handleToggleCategory(category: string) {
    onChange(toggleCategoryGroup(value, category, options, hardDenied))
  }

  function handleResetDefaults() {
    if (resetDisabled) return
    onChange([...defaultEnabled])
  }

  function handleDisableAll() {
    if (disableAllDisabled) return
    onChange([])
  }

  // ---------- Render: error short-circuits ----------

  if (error === 'github_not_connected') {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-2 text-xs text-[var(--muted)]">
          <AlertCircle size={13} className="shrink-0 text-amber-500" />
          Connect GitHub to manage tools.
        </div>
      </div>
    )
  }

  const showLoadingSkeleton = loading && options.length === 0

  return (
    <div className="flex flex-col gap-3">
      {/* Save-error banner (matches repo picker) */}
      {saveError && (
        <div className="flex items-center gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-[var(--muted)]">
          <AlertCircle size={13} className="shrink-0 text-red-500" />
          <span className="flex-1">Could not save your changes. Try toggling again.</span>
          <button
            type="button"
            onClick={onDismissSaveError}
            aria-label="Dismiss save error"
            className="shrink-0 rounded px-2 py-0.5 text-xs text-[var(--foreground)] transition-colors hover:bg-[var(--border)]"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Fetch error */}
      {error === 'fetch_failed' && (
        <div className="flex items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-2 text-xs text-[var(--muted)]">
          <AlertCircle size={13} className="shrink-0 text-red-500" />
          <span className="flex-1">Could not load tools.</span>
          <button
            type="button"
            onClick={onRetryLoad}
            className="shrink-0 rounded px-2 py-0.5 text-xs text-[var(--foreground)] transition-colors hover:bg-[var(--border)]"
          >
            Retry
          </button>
        </div>
      )}

      {error === 'rate_limited' && (
        <div className="flex items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-2 text-xs text-[var(--muted)]">
          <AlertCircle size={13} className="shrink-0 text-amber-500" />
          Hit GitHub rate limit. Try again in a minute.
        </div>
      )}

      {/* Header row: quick actions + count */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleResetDefaults}
          disabled={resetDisabled}
          className="rounded-md border border-[var(--border)] bg-[var(--background)] px-2.5 py-1 text-xs text-[var(--foreground)] transition-colors hover:bg-[var(--surface-subtle)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-[var(--background)]"
        >
          Reset to defaults
        </button>
        <button
          type="button"
          onClick={handleDisableAll}
          disabled={disableAllDisabled}
          className="rounded-md border border-[var(--border)] bg-[var(--background)] px-2.5 py-1 text-xs text-[var(--foreground)] transition-colors hover:bg-[var(--surface-subtle)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-[var(--background)]"
        >
          Disable all
        </button>
        <span className="ml-auto text-xs text-[var(--muted)]">
          {value.length} of {totalToggleable} tools enabled
        </span>
      </div>

      {/* Body: skeleton, empty, or category list */}
      {showLoadingSkeleton ? (
        <div className="flex items-center justify-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface-subtle)] py-6 text-xs text-[var(--muted)]">
          <Loader2 size={13} className="animate-spin" />
          Loading tools...
        </div>
      ) : buckets.length === 0 && !error ? (
        <p className="rounded-md border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-2 text-xs text-[var(--muted)]">
          No tools available.
        </p>
      ) : (
        <div className="flex flex-col gap-1">
          {buckets.map((bucket) => (
            <CategoryGroup
              key={bucket.category}
              bucket={bucket}
              open={isOpen(bucket.category)}
              onOpenChange={(next) => setOpen(bucket.category, next)}
              enabledSet={enabledSet}
              hardDeniedSet={hardDeniedSet}
              indeterminate={isCategoryIndeterminate(
                value,
                bucket.category,
                options,
                hardDenied,
              )}
              allEnabled={isCategoryAllEnabled(
                value,
                bucket.category,
                options,
                hardDenied,
              )}
              onToggleCategory={() => handleToggleCategory(bucket.category)}
              onToggleTool={handleToggleTool}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Internal sub-components.
// ---------------------------------------------------------------------------

interface CategoryGroupProps {
  bucket: CategoryBuckets
  open: boolean
  onOpenChange: (next: boolean) => void
  enabledSet: ReadonlySet<string>
  hardDeniedSet: ReadonlySet<string>
  indeterminate: boolean
  allEnabled: boolean
  onToggleCategory: () => void
  onToggleTool: (slug: string) => void
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function CategoryGroup({
  bucket,
  open,
  onOpenChange,
  enabledSet,
  hardDeniedSet,
  indeterminate,
  allEnabled,
  onToggleCategory,
  onToggleTool,
}: CategoryGroupProps) {
  const { category, items, enabledCount, toggleableTotal } = bucket
  const sectionId = `gh-tools-cat-${slugify(category)}`
  const buttonId = `${sectionId}-toggle`
  const groupCheckLabel = allEnabled
    ? `Disable all in ${category}`
    : `Enable all in ${category}`

  return (
    <div className="overflow-hidden rounded-md border border-[var(--border)] bg-[var(--background)]">
      <div className="flex items-center gap-2 px-2 py-1.5">
        <button
          type="button"
          id={buttonId}
          aria-expanded={open}
          aria-controls={sectionId}
          onClick={() => onOpenChange(!open)}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-[var(--muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]"
        >
          {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          <span className="sr-only">{open ? 'Collapse' : 'Expand'} {category}</span>
        </button>

        <GroupCheckbox
          checked={allEnabled}
          indeterminate={indeterminate}
          disabled={toggleableTotal === 0}
          onToggle={onToggleCategory}
          ariaLabel={groupCheckLabel}
        />

        <button
          type="button"
          onClick={() => onOpenChange(!open)}
          aria-controls={sectionId}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-2 text-left text-xs text-[var(--foreground)]"
        >
          <span className="truncate font-medium">{category}</span>
          <span className="shrink-0 rounded-full border border-[var(--border)] bg-[var(--surface-subtle)] px-1.5 py-0.5 text-[10px] text-[var(--muted)]">
            {enabledCount} / {toggleableTotal}
          </span>
        </button>
      </div>

      {open ? (
        <div
          id={sectionId}
          role="group"
          aria-labelledby={buttonId}
          className="border-t border-[var(--border)] bg-[var(--surface-subtle)] p-1"
        >
          {items.map((info) => {
            const isDenied = hardDeniedSet.has(info.slug)
            const isChecked = enabledSet.has(info.slug)
            return (
              <ToolRow
                key={info.slug}
                info={info}
                checked={isChecked}
                hardDenied={isDenied}
                onToggle={onToggleTool}
              />
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

interface GroupCheckboxProps {
  checked: boolean
  indeterminate: boolean
  disabled: boolean
  onToggle: () => void
  ariaLabel: string
}

function GroupCheckbox({
  checked,
  indeterminate,
  disabled,
  onToggle,
  ariaLabel,
}: GroupCheckboxProps) {
  const ariaChecked: 'true' | 'false' | 'mixed' = indeterminate
    ? 'mixed'
    : checked
      ? 'true'
      : 'false'
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={ariaChecked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onToggle}
      className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] transition-colors hover:bg-[var(--surface-subtle)] disabled:cursor-not-allowed disabled:opacity-40"
    >
      {indeterminate ? (
        <Minus size={11} strokeWidth={2.5} />
      ) : checked ? (
        <Check size={11} strokeWidth={2} />
      ) : null}
    </button>
  )
}

interface ToolRowProps {
  info: GithubToolInfo
  checked: boolean
  hardDenied: boolean
  onToggle: (slug: string) => void
}

function ToolRow({ info, checked, hardDenied, onToggle }: ToolRowProps) {
  const describedById = hardDenied ? `gh-tools-denied-${info.slug}` : undefined
  const rowClasses = hardDenied
    ? 'flex w-full items-start gap-2.5 rounded-md px-2 py-1.5 text-left text-xs opacity-50'
    : 'flex w-full items-start gap-2.5 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-[var(--background)]'

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-disabled={hardDenied || undefined}
      aria-label={`Enable ${info.slug}`}
      aria-describedby={describedById}
      disabled={hardDenied}
      onClick={() => onToggle(info.slug)}
      className={`${rowClasses} disabled:cursor-not-allowed`}
      title={hardDenied ? 'Blocked by policy — cannot be enabled' : undefined}
    >
      <span
        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border border-[var(--border)] ${
          hardDenied ? 'bg-[var(--surface-subtle)]' : 'bg-[var(--background)]'
        } text-[var(--foreground)]`}
      >
        {checked && !hardDenied ? <Check size={11} strokeWidth={2} /> : null}
        {hardDenied ? <Lock size={9} className="text-[var(--muted)]" /> : null}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-1.5">
          <code className="truncate font-mono text-[11px] text-[var(--foreground)]">
            {info.slug}
          </code>
          {info.name ? (
            <span className="truncate text-[var(--muted)]">— {info.name}</span>
          ) : null}
        </span>
        {info.description ? (
          <span className="truncate text-[10px] text-[var(--muted)]">
            {info.description}
          </span>
        ) : null}
      </span>
      {hardDenied ? (
        <span id={describedById} className="sr-only">
          Blocked by policy — cannot be enabled
        </span>
      ) : null}
    </button>
  )
}
