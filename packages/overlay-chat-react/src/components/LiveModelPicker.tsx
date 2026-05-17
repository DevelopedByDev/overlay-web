'use client'

import React from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { ModelBadges, ModelQualitiesPanel, type ChatModelQualityInfo } from './ModelIndicators'

export type LiveGenerationMode = 'text' | 'image' | 'video'
export type LiveSelectionMode = 'single' | 'multiple'
export type LiveTooltipRenderer = (options: {
  label: string
  side: 'top' | 'bottom'
  children: React.ReactNode
}) => React.ReactNode

export interface LiveTextModel extends ChatModelQualityInfo {
  id: string
  name: string
}

export interface LiveMediaModel {
  id: string
  name: string
}

export interface LiveModelPickerHoverPosition {
  x: number
  y: number
}

function withTooltip(
  renderTooltip: LiveTooltipRenderer | undefined,
  label: string | undefined,
  side: 'top' | 'bottom',
  children: React.ReactNode,
) {
  return renderTooltip && label ? renderTooltip({ label, side, children }) : children
}

function dividerLabelForModel({
  index,
  models,
  modelId,
  isFreeTier,
  isFreeModelId,
}: {
  index: number
  models: LiveTextModel[]
  modelId: string
  isFreeTier: boolean
  isFreeModelId: (id: string) => boolean
}): 'Premium' | 'Free' | null {
  const isFreeModelRow = isFreeModelId(modelId)
  const previous = models[index - 1]
  const previousIsFreeModelRow = previous ? isFreeModelId(previous.id) : false
  const showFreeTierGroupDivider = isFreeTier && !isFreeModelRow && previousIsFreeModelRow
  const showFreeGroupDivider = !isFreeTier && isFreeModelRow && !previousIsFreeModelRow
  if (showFreeTierGroupDivider) return 'Premium'
  if (showFreeGroupDivider) return 'Free'
  return null
}

function SelectionModeControls({
  value,
  onChange,
  isOptionDisabled,
}: {
  value: LiveSelectionMode
  onChange: (value: LiveSelectionMode) => void
  isOptionDisabled: (value: LiveSelectionMode) => boolean
}) {
  return (
    <div className="border-t border-[var(--border)] px-2 py-2">
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-[var(--surface-subtle)] p-0.5">
        {(['single', 'multiple'] as const).map((mode) => {
          const isActive = value === mode
          const disabled = isOptionDisabled(mode)
          return (
            <button
              key={mode}
              type="button"
              onClick={() => onChange(mode)}
              disabled={disabled}
              className={`rounded-md px-2 py-1 text-[11px] font-medium capitalize transition-colors ${
                isActive
                  ? 'bg-[var(--surface-elevated)] font-medium text-[var(--foreground)] shadow-sm'
                  : 'text-[var(--muted)] hover:text-[var(--foreground)]'
              } ${disabled ? 'cursor-not-allowed opacity-40' : ''}`}
            >
              {mode}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function LiveModelPicker({
  rootRef,
  listRef,
  className,
  label,
  tooltipLabel,
  tooltipSide = 'bottom',
  renderTooltip,
  open,
  disabled = false,
  generationMode,
  textModels,
  imageModels,
  videoModels,
  selectedTextModelIds,
  selectedImageModelIds,
  selectedVideoModelIds,
  textSelectionMode,
  imageSelectionMode,
  videoSelectionMode,
  showTextSelectionControls = false,
  showImageSelectionControls = false,
  showVideoSelectionControls = false,
  textMaxSelected = 4,
  imageMaxSelected = 4,
  videoMaxSelected = 4,
  isFreeTier,
  isActiveLoading = false,
  isFreeTextModelId,
  hoveredModelId,
  hoverPosition,
  qualityModel,
  onToggleOpen,
  onTextModelSelect,
  onImageModelSelect,
  onVideoModelSelect,
  onTextSelectionModeChange,
  onImageSelectionModeChange,
  onVideoSelectionModeChange,
  onHoverTextModel,
  onUpgradeClick,
}: {
  rootRef?: React.Ref<HTMLDivElement>
  listRef?: React.Ref<HTMLDivElement>
  className?: string
  label: string
  tooltipLabel?: string
  tooltipSide?: 'top' | 'bottom'
  renderTooltip?: LiveTooltipRenderer
  open: boolean
  disabled?: boolean
  generationMode: LiveGenerationMode
  textModels: LiveTextModel[]
  imageModels?: LiveMediaModel[]
  videoModels?: LiveMediaModel[]
  selectedTextModelIds: string[]
  selectedImageModelIds?: string[]
  selectedVideoModelIds?: string[]
  textSelectionMode?: LiveSelectionMode
  imageSelectionMode?: LiveSelectionMode
  videoSelectionMode?: LiveSelectionMode
  showTextSelectionControls?: boolean
  showImageSelectionControls?: boolean
  showVideoSelectionControls?: boolean
  textMaxSelected?: number
  imageMaxSelected?: number
  videoMaxSelected?: number
  isFreeTier: boolean
  isActiveLoading?: boolean
  isFreeTextModelId: (id: string) => boolean
  hoveredModelId?: string | null
  hoverPosition?: LiveModelPickerHoverPosition | null
  qualityModel?: ChatModelQualityInfo | null
  onToggleOpen: () => void
  onTextModelSelect: (id: string) => void
  onImageModelSelect?: (id: string) => void
  onVideoModelSelect?: (id: string) => void
  onTextSelectionModeChange?: (mode: LiveSelectionMode) => void
  onImageSelectionModeChange?: (mode: LiveSelectionMode) => void
  onVideoSelectionModeChange?: (mode: LiveSelectionMode) => void
  onHoverTextModel?: (id: string | null) => void
  onUpgradeClick?: () => void
}) {
  const trigger = (
    <button
      type="button"
      onClick={onToggleOpen}
      disabled={disabled}
      className="flex h-8 min-h-8 w-full min-w-0 items-center justify-between gap-2 rounded-md bg-[var(--surface-subtle)] px-2.5 py-0 text-left text-xs leading-none text-[var(--muted)] hover:bg-[var(--border)] disabled:cursor-default disabled:opacity-70 md:h-auto md:min-h-0 md:w-auto md:max-w-[13rem] md:py-1"
      aria-label={tooltipLabel}
    >
      <span className="min-w-0 truncate">{label}</span>
      <ChevronDown size={11} className="shrink-0" />
    </button>
  )

  const selectedMediaIds = generationMode === 'image' ? selectedImageModelIds ?? [] : selectedVideoModelIds ?? []
  const mediaSelectionMode = generationMode === 'image' ? imageSelectionMode : videoSelectionMode
  const mediaMaxSelected = generationMode === 'image' ? imageMaxSelected : videoMaxSelected
  const mediaModels = generationMode === 'image' ? imageModels ?? [] : videoModels ?? []
  const selectMediaModel = generationMode === 'image' ? onImageModelSelect : onVideoModelSelect

  return (
    <div ref={rootRef} data-tour="model-picker" className={className ?? 'relative min-w-0 flex-1 md:w-auto md:flex-none'}>
      {withTooltip(renderTooltip, tooltipLabel, tooltipSide, trigger)}
      {open ? (
        <>
          {generationMode === 'text' && hoveredModelId && hoverPosition ? (
            <div
              aria-hidden
              className="pointer-events-none fixed z-[100] hidden w-44 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 shadow-md md:block"
              style={{
                left: hoverPosition.x,
                top: hoverPosition.y,
                transform: 'translate(calc(-100% - 8px), -50%)',
              }}
            >
              <ModelQualitiesPanel model={qualityModel} />
            </div>
          ) : null}
          <div
            data-tour="model-picker"
            className="absolute left-0 right-0 top-full z-20 mt-1 max-w-[calc(100vw-1.5rem)] rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] py-1 shadow-lg md:left-auto md:right-0 md:w-64 md:max-w-none"
            onMouseLeave={() => onHoverTextModel?.(null)}
          >
            <div ref={listRef} className="max-h-72 overflow-y-auto">
              {generationMode === 'image' || generationMode === 'video'
                ? mediaModels.map((model) => {
                    const isSelected = selectedMediaIds.includes(model.id)
                    const isDisabled =
                      mediaSelectionMode === 'multiple' &&
                      !isSelected &&
                      selectedMediaIds.length >= mediaMaxSelected
                    return (
                      <button
                        key={model.id}
                        type="button"
                        disabled={isDisabled}
                        onClick={() => selectMediaModel?.(model.id)}
                        className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between ${
                          isDisabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-[var(--surface-muted)]'
                        } ${isSelected ? 'text-[var(--foreground)] font-medium' : 'text-[var(--muted)]'}`}
                      >
                        <span className="flex items-center gap-2">
                          {isSelected ? <Check size={10} /> : <span className="w-[10px] inline-block" />}
                          {model.name}
                        </span>
                      </button>
                    )
                  })
                : textModels.map((model, index, models) => {
                    const isSelected = selectedTextModelIds.includes(model.id)
                    const isDisabled =
                      textSelectionMode === 'multiple' &&
                      !isSelected &&
                      selectedTextModelIds.length >= textMaxSelected
                    const dividerLabel = dividerLabelForModel({
                      index,
                      models,
                      modelId: model.id,
                      isFreeTier,
                      isFreeModelId: isFreeTextModelId,
                    })
                    return (
                      <div key={model.id}>
                        {dividerLabel ? (
                          <div className="mt-1 border-t border-[var(--border)] px-3 pb-1 pt-2 text-[9px] font-medium uppercase tracking-[0.08em] text-[var(--muted-light)]">
                            {dividerLabel}
                          </div>
                        ) : null}
                        <button
                          type="button"
                          data-model-row={model.id}
                          disabled={isDisabled}
                          onClick={() => onTextModelSelect(model.id)}
                          onMouseEnter={() => onHoverTextModel?.(model.id)}
                          className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between ${
                            isDisabled ? 'cursor-not-allowed opacity-40' : 'hover:bg-[var(--surface-muted)]'
                          } ${isSelected ? 'text-[var(--foreground)] font-medium' : 'text-[var(--muted)]'}`}
                        >
                          <span className="flex items-center gap-2">
                            {isSelected ? <Check size={10} /> : <span className="w-[10px] inline-block" />}
                            {model.name}
                          </span>
                          <ModelBadges model={model} isFreeTier={isFreeTier} onUpgradeClick={onUpgradeClick} />
                        </button>
                      </div>
                    )
                  })}
            </div>
            {generationMode === 'image' && showImageSelectionControls && imageSelectionMode && onImageSelectionModeChange ? (
              <SelectionModeControls
                value={imageSelectionMode}
                onChange={onImageSelectionModeChange}
                isOptionDisabled={(mode) => isActiveLoading || (isFreeTier && mode === 'multiple')}
              />
            ) : null}
            {generationMode === 'video' && showVideoSelectionControls && videoSelectionMode && onVideoSelectionModeChange ? (
              <SelectionModeControls
                value={videoSelectionMode}
                onChange={onVideoSelectionModeChange}
                isOptionDisabled={(mode) => isActiveLoading || (isFreeTier && mode === 'multiple')}
              />
            ) : null}
            {generationMode === 'text' && showTextSelectionControls && textSelectionMode && onTextSelectionModeChange ? (
              <SelectionModeControls
                value={textSelectionMode}
                onChange={onTextSelectionModeChange}
                isOptionDisabled={(mode) => isFreeTier && mode === 'multiple'}
              />
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  )
}
