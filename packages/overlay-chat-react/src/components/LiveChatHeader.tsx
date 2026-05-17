'use client'

import React from 'react'
import { FolderOpen, Pencil } from 'lucide-react'

export interface LiveChatHeaderAutomationTab {
  id: string
  label: string
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>
}

export function LiveChatHeader({
  hidden = false,
  title,
  projectName,
  editing,
  editingTitle,
  titleInputRef,
  onEditingTitleChange,
  onTitleKeyDown,
  onTitleBlur,
  canRename,
  onBeginRename,
  showAutomationControls,
  automationModelPicker,
  automationTabs,
  activeAutomationTabId,
  onAutomationTabSelect,
  showChatControls,
  videoSubModePicker,
  upgradeControl,
  modelPicker,
  mobileControls,
  generationModeToggle,
  exportControl,
}: {
  hidden?: boolean
  title: string
  projectName?: string
  editing: boolean
  editingTitle: string
  titleInputRef?: React.Ref<HTMLInputElement>
  onEditingTitleChange: (value: string) => void
  onTitleKeyDown: React.KeyboardEventHandler<HTMLInputElement>
  onTitleBlur: React.FocusEventHandler<HTMLInputElement>
  canRename?: boolean
  onBeginRename?: () => void
  showAutomationControls?: boolean
  automationModelPicker?: React.ReactNode
  automationTabs?: LiveChatHeaderAutomationTab[]
  activeAutomationTabId?: string
  onAutomationTabSelect?: (id: string) => void
  showChatControls?: boolean
  videoSubModePicker?: React.ReactNode
  upgradeControl?: React.ReactNode
  modelPicker?: React.ReactNode
  mobileControls?: React.ReactNode
  generationModeToggle?: React.ReactNode
  exportControl?: React.ReactNode
}) {
  return (
    <div className={`flex shrink-0 flex-col gap-2 border-b border-[var(--border)] px-3 py-2.5 md:h-16 md:min-h-16 md:max-h-16 md:flex-row md:items-center md:justify-between md:gap-3 md:overflow-visible md:py-0 md:px-4 ${hidden ? 'hidden' : ''}`}>
      <div
        className={`group/header-title min-w-0 items-center gap-2 ${
          editing
            ? 'flex w-full'
            : showAutomationControls
              ? 'flex w-full flex-wrap md:w-auto md:flex-nowrap'
              : 'hidden min-[768px]:flex'
        }`}
      >
        {editing ? (
          <input
            ref={titleInputRef}
            className="min-w-0 flex-1 rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-sm font-medium text-[var(--foreground)] outline-none focus:ring-1 focus:ring-[var(--foreground)] md:max-w-[min(100%,20rem)] lg:max-w-[24rem]"
            value={editingTitle}
            onChange={(event) => onEditingTitleChange(event.target.value)}
            onKeyDown={onTitleKeyDown}
            onBlur={onTitleBlur}
          />
        ) : (
          <div className="flex min-w-0 items-center gap-1">
            <h2 className="min-w-0 max-w-[min(100%,20rem)] text-sm font-medium leading-snug text-[var(--foreground)] md:truncate lg:max-w-[24rem]">
              <span className="line-clamp-2 md:line-clamp-1 md:truncate">
                {title}
              </span>
            </h2>
            {canRename ? (
              <button
                type="button"
                onClick={onBeginRename}
                className="shrink-0 rounded p-1 text-[var(--muted)] opacity-0 transition-opacity hover:bg-[var(--border)] hover:text-[var(--foreground)] group-hover/header-title:opacity-100 focus-visible:opacity-100"
                aria-label="Rename chat"
              >
                <Pencil size={14} />
              </button>
            ) : null}
          </div>
        )}
        {projectName ? (
          <span className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-[var(--border)] bg-[var(--surface-subtle)] px-2 py-0.5 text-[10px] text-[var(--muted)]">
            <FolderOpen size={9} />
            <span className="max-w-[6rem] truncate sm:max-w-none">{projectName}</span>
          </span>
        ) : null}
      </div>

      {showAutomationControls ? (
        <div className="flex w-full shrink-0 items-center justify-end gap-2 md:w-auto">
          {automationModelPicker}
          {automationTabs && automationTabs.length > 0 ? (
            <div className="flex shrink-0 items-center rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)] p-0.5">
              {automationTabs.map((tab) => {
                const active = activeAutomationTabId === tab.id
                const TabIcon = tab.icon
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => onAutomationTabSelect?.(tab.id)}
                    className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                      active
                        ? 'bg-[var(--surface-elevated)] text-[var(--foreground)] shadow-sm'
                        : 'text-[var(--muted)] hover:text-[var(--foreground)]'
                    }`}
                  >
                    <TabIcon size={12} strokeWidth={1.75} />
                    {tab.label}
                  </button>
                )
              })}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className={`flex w-full min-w-0 flex-col gap-2 md:min-w-0 md:flex-1 md:flex-row md:items-center md:justify-end md:gap-2 ${
        showChatControls ? '' : 'hidden'
      }`}>
        {videoSubModePicker}
        {upgradeControl}
        <div className="flex w-full min-w-0 items-center justify-between gap-2 md:contents">
          {modelPicker}
          {mobileControls ? (
            <div className="flex shrink-0 items-center gap-1.5 md:hidden">
              {mobileControls}
            </div>
          ) : null}
        </div>
        {generationModeToggle}
        {exportControl}
      </div>
    </div>
  )
}
