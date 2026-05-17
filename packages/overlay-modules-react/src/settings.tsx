'use client'

import type { ReactNode } from 'react'
import type { OverlaySettingsPanel, OverlaySettingsSection } from '@overlay/app-core'
import { EmptyState, cn } from '@overlay/ui'

export type SettingsPanelRenderer = (panel: OverlaySettingsPanel) => ReactNode

export interface SettingsSectionRendererProps {
  sections: readonly OverlaySettingsSection[]
  panels: readonly OverlaySettingsPanel[]
  activeSectionId?: string | null
  activePanelId?: string | null
  loading?: boolean
  onSelectSection?: (section: OverlaySettingsSection) => void
  renderPanel: SettingsPanelRenderer
}

export function SettingsSectionRenderer({
  sections,
  panels,
  activeSectionId,
  activePanelId,
  loading,
  onSelectSection,
  renderPanel,
}: SettingsSectionRendererProps) {
  const activeSection = sections.find((section) => section.id === activeSectionId) ?? sections[0] ?? null
  const activePanels = activeSection
    ? panels.filter((panel) => panel.sectionId === activeSection.id).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    : []
  const selectedPanel =
    activePanels.find((panel) => panel.id === activePanelId) ?? activePanels[0] ?? null

  return (
    <section className="flex h-full min-h-0 bg-[var(--background)] text-[var(--foreground)]">
      <aside className="w-64 shrink-0 border-r border-[var(--border)] bg-[var(--sidebar-surface)] p-2">
        {sections.map((section) => (
          <button
            key={section.id}
            type="button"
            disabled={section.disabled}
            onClick={() => onSelectSection?.(section)}
            className={cn(
              'flex w-full items-center rounded-lg px-3 py-2 text-left text-sm transition-colors',
              activeSection?.id === section.id
                ? 'bg-[var(--surface-subtle)] font-medium text-[var(--foreground)]'
                : 'text-[var(--muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]',
            )}
          >
            {section.label}
          </button>
        ))}
      </aside>
      <main className="min-w-0 flex-1 overflow-auto p-6">
        {loading ? (
          <div className="text-xs text-[var(--muted)]">Loading settings...</div>
        ) : selectedPanel ? (
          <div className="mx-auto max-w-3xl">
            <div className="mb-5">
              <h1 className="text-lg font-semibold">{selectedPanel.label}</h1>
              {selectedPanel.description ? (
                <p className="mt-1 text-sm text-[var(--muted)]">{selectedPanel.description}</p>
              ) : null}
            </div>
            {renderPanel(selectedPanel)}
          </div>
        ) : (
          <EmptyState className="h-full" title="No settings panel registered" />
        )}
      </main>
    </section>
  )
}
