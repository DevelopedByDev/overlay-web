'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import type { ProjectSettingsSectionId } from '@overlay/app-core'

export interface ProjectSettingsSection {
  id: ProjectSettingsSectionId
  label: string
  icon?: ReactNode
  render: () => ReactNode
}

export interface ProjectSettingsDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectName: string
  sections: readonly ProjectSettingsSection[]
  activeSectionId: ProjectSettingsSectionId
  onActiveSectionChange: (id: ProjectSettingsSectionId) => void
  layoutMode: 'push' | 'overlay'
  width?: number
}

export function ProjectSettingsDrawer({
  open,
  onOpenChange,
  projectName,
  sections,
  activeSectionId,
  onActiveSectionChange,
  layoutMode,
  width = 360,
}: ProjectSettingsDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open || layoutMode !== 'overlay') return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onOpenChange(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, layoutMode, onOpenChange])

  if (!open) return null

  const activeSection = sections.find((s) => s.id === activeSectionId) ?? sections[0]

  const drawer = (
    <div
      ref={drawerRef}
      className="flex h-full flex-col border-l border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--foreground)]"
      style={{ width: `${width}px` }}
    >
      {/* Header */}
      <div className="flex min-h-14 shrink-0 items-center justify-between border-b border-[var(--border)] px-4">
        <p className="truncate text-sm font-semibold text-[var(--foreground)]">{projectName}</p>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="rounded-md p-1.5 text-[var(--muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]"
          aria-label="Close settings"
        >
          <X size={16} />
        </button>
      </div>

      {/* Body: two-column layout */}
      <div className="flex min-h-0 flex-1">
        {/* Left rail: section buttons */}
        <nav className="flex w-36 shrink-0 flex-col gap-0.5 border-r border-[var(--border)] p-2">
          {sections.map((section) => {
            const isActive = section.id === activeSectionId
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => onActiveSectionChange(section.id)}
                className={[
                  'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs transition-colors',
                  isActive
                    ? 'bg-[var(--surface-subtle)] text-[var(--foreground)]'
                    : 'text-[var(--muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]',
                ].join(' ')}
              >
                {section.icon ? <span className="shrink-0">{section.icon}</span> : null}
                <span className="truncate">{section.label}</span>
              </button>
            )
          })}
        </nav>

        {/* Right: scrollable content panel */}
        <div className="min-w-0 flex-1 overflow-y-auto p-4">
          {activeSection ? activeSection.render() : null}
        </div>
      </div>
    </div>
  )

  if (layoutMode === 'push') {
    return drawer
  }

  // overlay mode: absolute panel with dimmed backdrop
  return (
    <div
      className="absolute inset-0 z-40"
      onClick={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false)
      }}
      style={{ backgroundColor: 'var(--overlay-scrim, rgba(0,0,0,0.35))' }}
    >
      <div className="absolute inset-y-0 right-0">
        {drawer}
      </div>
    </div>
  )
}
