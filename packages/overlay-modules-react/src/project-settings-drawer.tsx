'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronDown, X } from 'lucide-react'
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
  width = 520,
}: ProjectSettingsDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null)
  const sectionMenuRef = useRef<HTMLDivElement>(null)
  const [sectionMenuOpen, setSectionMenuOpen] = useState(false)

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

  useEffect(() => {
    if (!sectionMenuOpen) return

    function handleMouseDown(event: MouseEvent) {
      if (sectionMenuRef.current && !sectionMenuRef.current.contains(event.target as Node)) {
        setSectionMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [sectionMenuOpen])

  if (!open) return null

  const activeSection = sections.find((s) => s.id === activeSectionId) ?? sections[0]

  const drawer = (
    <div
      ref={drawerRef}
      className="flex h-full flex-col border-l border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--foreground)]"
      style={{ width: layoutMode === 'overlay' ? `min(${width}px, 100vw)` : `${width}px` }}
    >
      {/* Header */}
      <div className="flex min-h-14 shrink-0 items-center justify-between gap-3 border-b border-[var(--border)] px-4">
        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--foreground)]">{projectName}</p>
        {activeSection ? (
          <div ref={sectionMenuRef} className="relative shrink-0">
            <button
              type="button"
              onClick={() => setSectionMenuOpen((value) => !value)}
              className="inline-flex h-8 max-w-[220px] items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface-subtle)] px-2.5 text-xs text-[var(--foreground)] transition-colors hover:bg-[var(--border)]"
              aria-haspopup="listbox"
              aria-expanded={sectionMenuOpen}
            >
              {activeSection.icon ? <span className="shrink-0 text-[var(--muted)]">{activeSection.icon}</span> : null}
              <span className="min-w-0 truncate">{activeSection.label}</span>
              <ChevronDown size={12} className="shrink-0 text-[var(--muted)]" />
            </button>
            {sectionMenuOpen ? (
              <div
                role="listbox"
                className="absolute right-0 top-full z-50 mt-1 w-52 overflow-hidden rounded-md border border-[var(--border)] bg-[var(--surface-elevated)] shadow-lg"
              >
                {sections.map((section) => {
                  const isActive = section.id === activeSectionId
                  return (
                    <button
                      key={section.id}
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      onClick={() => {
                        onActiveSectionChange(section.id)
                        setSectionMenuOpen(false)
                      }}
                      className={[
                        'flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors',
                        isActive
                          ? 'bg-[var(--surface-subtle)] text-[var(--foreground)]'
                          : 'text-[var(--muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]',
                      ].join(' ')}
                    >
                      {section.icon ? <span className="shrink-0">{section.icon}</span> : null}
                      <span className="min-w-0 flex-1 truncate">{section.label}</span>
                    </button>
                  )
                })}
              </div>
            ) : null}
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="rounded-md p-1.5 text-[var(--muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]"
          aria-label="Close settings"
        >
          <X size={16} />
        </button>
      </div>

      {/* Body */}
      <div className="min-w-0 flex-1 overflow-y-auto p-4">
        {activeSection ? activeSection.render() : null}
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
