'use client'

import { useState } from 'react'
import { AlertCircle, GitBranch, Loader2, Search } from 'lucide-react'
import {
  isValidGithubRepoFullName,
  sortGithubRepoOptionsSelectedFirst,
  type GithubRepositoryOption,
} from '@overlay/app-core'

export interface GithubRepoAllowlistPickerProps {
  value: readonly string[]
  options: readonly GithubRepositoryOption[]
  loading: boolean
  error: 'github_not_connected' | 'fetch_failed' | 'rate_limited' | null
  manualEntry: string
  onChange: (next: readonly string[]) => void
  onAddManual: (entry: string) => void
  onManualEntryChange: (text: string) => void
  onRetryLoad: () => void
}

export function GithubRepoAllowlistPicker({
  value,
  options,
  loading,
  error,
  manualEntry,
  onChange,
  onAddManual,
  onManualEntryChange,
  onRetryLoad,
}: GithubRepoAllowlistPickerProps) {
  const [query, setQuery] = useState('')
  const [manualEntryError, setManualEntryError] = useState<string | null>(null)

  const sorted = sortGithubRepoOptionsSelectedFirst(options, value, query)

  function handleToggle(fullName: string) {
    const next = value.includes(fullName)
      ? value.filter((v) => v !== fullName)
      : [...value, fullName]
    onChange(next)
  }

  function handleAddManual() {
    const trimmed = manualEntry.trim()
    if (!isValidGithubRepoFullName(trimmed)) {
      setManualEntryError('Enter a valid owner/repo name (e.g. acme/my-repo).')
      return
    }
    setManualEntryError(null)
    onAddManual(trimmed.toLowerCase())
  }

  function handleManualKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      handleAddManual()
    }
  }

  const showList = error !== 'github_not_connected'
  const showLoadingSkeleton = loading && options.length === 0

  return (
    <div className="flex flex-col gap-3">
      {/* Search input */}
      {showList && (
        <div className="flex items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--background)] px-2.5 py-1.5">
          <Search size={13} className="shrink-0 text-[var(--muted)]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search repositories…"
            className="min-w-0 flex-1 bg-transparent text-xs text-[var(--foreground)] placeholder-[var(--muted)] outline-none"
          />
        </div>
      )}

      {/* Error banners */}
      {error === 'github_not_connected' && (
        <div className="rounded-md border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-3 text-xs text-[var(--muted)]">
          <div className="flex items-center gap-2 font-medium text-[var(--foreground)]">
            <GitBranch size={13} className="shrink-0" />
            GitHub not connected
          </div>
          <p className="mt-1 leading-relaxed">
            Connect your GitHub account via Integrations to browse and select repositories.
            You can still add repositories manually below.
          </p>
        </div>
      )}

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

      {/* Repository list */}
      {showList && (
        <div className="flex flex-col gap-0.5">
          {showLoadingSkeleton ? (
            <div className="flex items-center justify-center gap-2 py-6 text-xs text-[var(--muted)]">
              <Loader2 size={13} className="animate-spin" />
              Loading repositories…
            </div>
          ) : sorted.length === 0 && !loading ? (
            <p className="px-1 py-2 text-xs text-[var(--muted)]">
              No repositories found in your GitHub account.
            </p>
          ) : (
            sorted.map((option) => (
              <RepoRow
                key={option.fullName}
                option={option}
                checked={value.includes(option.fullName)}
                onToggle={handleToggle}
              />
            ))
          )}
        </div>
      )}

      {/* Permissive-default hint */}
      {showList && value.length === 0 && options.length > 0 && error === null && (
        <p className="text-xs text-[var(--muted)]">
          All repositories are accessible (no allowlist set).
        </p>
      )}

      {/* Manual entry row — always visible except when github_not_connected */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={manualEntry}
            onChange={(e) => {
              onManualEntryChange(e.target.value)
              if (manualEntryError) setManualEntryError(null)
            }}
            onKeyDown={handleManualKeyDown}
            placeholder="owner/repo"
            aria-label="Add repository manually"
            className="min-w-0 flex-1 rounded-md border border-[var(--border)] bg-[var(--background)] px-2.5 py-1.5 text-xs text-[var(--foreground)] placeholder-[var(--muted)] outline-none focus:ring-1 focus:ring-[var(--foreground)]"
          />
          <button
            type="button"
            onClick={handleAddManual}
            className="shrink-0 rounded-md border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-1.5 text-xs text-[var(--foreground)] transition-colors hover:bg-[var(--border)]"
          >
            Add
          </button>
        </div>
        {manualEntryError && (
          <p className="text-xs text-red-500">{manualEntryError}</p>
        )}
      </div>
    </div>
  )
}

interface RepoRowProps {
  option: GithubRepositoryOption
  checked: boolean
  onToggle: (fullName: string) => void
}

function RepoRow({ option, checked, onToggle }: RepoRowProps) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-[var(--surface-subtle)]">
      <input
        type="checkbox"
        checked={checked}
        onChange={() => onToggle(option.fullName)}
        className="shrink-0 accent-[var(--foreground)]"
      />
      <span className="min-w-0 flex-1 truncate text-[var(--foreground)]">{option.fullName}</span>
      {option.private && (
        <span className="shrink-0 rounded-full border border-[var(--border)] bg-[var(--surface-subtle)] px-1.5 py-0.5 text-[10px] text-[var(--muted)]">
          private
        </span>
      )}
      {option.archived && (
        <span className="shrink-0 rounded-full border border-[var(--border)] bg-[var(--surface-subtle)] px-1.5 py-0.5 text-[10px] text-[var(--muted)]">
          archived
        </span>
      )}
    </label>
  )
}
