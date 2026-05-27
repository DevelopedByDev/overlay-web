'use client'

import { useEffect, useRef, useState } from 'react'
import { AlertCircle, Check, ChevronDown, Loader2, Search } from 'lucide-react'
import {
  sortGithubRepoOptionsSelectedFirst,
  type GithubRepositoryOption,
} from '@overlay/app-core'

export interface GithubRepoAllowlistPickerProps {
  value: readonly string[]
  options: readonly GithubRepositoryOption[]
  loading: boolean
  error: 'github_not_connected' | 'fetch_failed' | 'rate_limited' | null
  /** True when the last save round-trip failed; the parent surfaces this to give the user retry feedback. */
  saveError: boolean
  onChange: (next: readonly string[]) => void
  onRetryLoad: () => void
  /** Dismiss handler for the save-error banner; clears the error in the parent. */
  onDismissSaveError: () => void
  presentation?: 'dropdown' | 'menu'
}

export function GithubRepoAllowlistPicker({
  value,
  options,
  loading,
  error,
  saveError,
  onChange,
  onRetryLoad,
  onDismissSaveError,
  presentation = 'dropdown',
}: GithubRepoAllowlistPickerProps) {
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const optionFullNames = new Set(options.map((option) => option.fullName))
  const dropdownOptions: GithubRepositoryOption[] = [
    ...options,
    ...value
      .filter((fullName) => !optionFullNames.has(fullName))
      .map((fullName) => ({ fullName })),
  ]
  const sorted = sortGithubRepoOptionsSelectedFirst(dropdownOptions, value, query)
  const selectedSet = new Set(value)
  const selectedLabel =
    value.length === 0
      ? 'Select repositories'
      : value.length === 1
        ? value[0]
        : `${value.length} repositories selected`

  useEffect(() => {
    if (!open) return

    function handleMouseDown(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  function handleToggle(fullName: string) {
    const next = value.includes(fullName)
      ? value.filter((v) => v !== fullName)
      : [...value, fullName]
    onChange(next)
  }

  const showList = error !== 'github_not_connected'
  const showLoadingSkeleton = loading && options.length === 0
  const repositoryMenu = showList ? (
    <>
      <div className="flex items-center gap-2 border-b border-[var(--border)] px-2.5 py-2">
        <Search size={13} className="shrink-0 text-[var(--muted)]" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search repositories..."
          className="h-6 min-w-0 flex-1 bg-transparent text-xs text-[var(--foreground)] placeholder-[var(--muted)] outline-none"
          autoFocus={presentation === 'dropdown' ? open : true}
        />
      </div>

      <div className="max-h-64 overflow-y-auto p-1">
        {showLoadingSkeleton ? (
          <div className="flex items-center justify-center gap-2 py-6 text-xs text-[var(--muted)]">
            <Loader2 size={13} className="animate-spin" />
            Loading repositories...
          </div>
        ) : sorted.length === 0 && !loading ? (
          <p className="px-2 py-3 text-xs text-[var(--muted)]">
            {query.trim() ? 'No repositories match your search.' : 'No repositories found in your GitHub account.'}
          </p>
        ) : (
          sorted.map((option) => (
            <RepoOption
              key={option.fullName}
              option={option}
              checked={selectedSet.has(option.fullName)}
              onToggle={handleToggle}
            />
          ))
        )}
      </div>
    </>
  ) : null

  return (
    <div className="flex flex-col gap-3">
      {/* Error banners */}
      {error === 'fetch_failed' && (
        <div className="flex items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-2 text-xs text-[var(--muted)]">
          <AlertCircle size={13} className="shrink-0 text-red-500" />
          <span className="flex-1">Could not load repositories.</span>
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
          GitHub rate limit hit — try again later.
        </div>
      )}

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

      {/* Repository dropdown */}
      {showList && presentation === 'menu' ? (
        <div className="overflow-hidden rounded-md border border-[var(--border)] bg-[var(--background)]">
          {repositoryMenu}
        </div>
      ) : null}

      {showList && presentation === 'dropdown' ? (
        <div ref={dropdownRef} className="relative">
          <button
            type="button"
            onClick={() => setOpen((next) => !next)}
            className="flex h-9 w-full items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--background)] px-2.5 text-left text-xs text-[var(--foreground)] transition-colors hover:bg-[var(--surface-subtle)]"
            aria-haspopup="listbox"
            aria-expanded={open}
          >
            <span className="min-w-0 flex-1 truncate">{selectedLabel}</span>
            {loading ? <Loader2 size={13} className="shrink-0 animate-spin text-[var(--muted)]" /> : null}
            <ChevronDown size={13} className="shrink-0 text-[var(--muted)]" />
          </button>

          {open ? (
            <div
              role="listbox"
              className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-md border border-[var(--border)] bg-[var(--surface-elevated)] shadow-lg"
            >
              {repositoryMenu}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Empty linked-repository hint */}
      {showList && value.length === 0 && options.length > 0 && error === null && (
        <p className="text-xs text-[var(--muted)]">
          No repositories linked yet.
        </p>
      )}
    </div>
  )
}

interface RepoOptionProps {
  option: GithubRepositoryOption
  checked: boolean
  onToggle: (fullName: string) => void
}

function RepoOption({ option, checked, onToggle }: RepoOptionProps) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={checked}
      onClick={() => onToggle(option.fullName)}
      className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-[var(--surface-subtle)]"
    >
      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)]">
        {checked ? <Check size={11} strokeWidth={2} /> : null}
      </span>
      <span className="min-w-0 flex-1 truncate text-[var(--foreground)]">{option.fullName}</span>
      <span className="shrink-0 rounded-full border border-[var(--border)] bg-[var(--surface-subtle)] px-1.5 py-0.5 text-[10px] text-[var(--muted)]">
        {option.private ? 'private' : 'public'}
      </span>
      {option.archived && (
        <span className="shrink-0 rounded-full border border-[var(--border)] bg-[var(--surface-subtle)] px-1.5 py-0.5 text-[10px] text-[var(--muted)]">
          archived
        </span>
      )}
    </button>
  )
}
