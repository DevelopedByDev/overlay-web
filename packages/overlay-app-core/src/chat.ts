import type { AppSettings, ChatModePreference } from './contracts'

export type ChatGenerationMode = 'text' | 'image' | 'video'
export type ChatModelSelectionMode = 'single' | 'multiple'

export interface ChatModelPreferenceState {
  selectedAskModelIds: string[]
  selectedActModelId: string
  selectionMode: ChatModelSelectionMode
  generationMode: ChatGenerationMode
}

export function createChatModelPreferenceState(input: {
  defaultAskModelIds?: readonly string[]
  defaultActModelId?: string
  fallbackModelId: string
  generationMode?: ChatGenerationMode
}): ChatModelPreferenceState {
  const askModels = normalizeModelIds(input.defaultAskModelIds, input.fallbackModelId)
  return {
    selectedAskModelIds: askModels,
    selectedActModelId: input.defaultActModelId?.trim() || askModels[0] || input.fallbackModelId,
    selectionMode: askModels.length > 1 ? 'multiple' : 'single',
    generationMode: input.generationMode ?? 'text',
  }
}

export function normalizeModelIds(
  modelIds: readonly string[] | undefined,
  fallbackModelId: string,
  maxModels = 4,
): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of modelIds ?? []) {
    const modelId = raw.trim()
    if (!modelId || seen.has(modelId)) continue
    seen.add(modelId)
    out.push(modelId)
    if (out.length >= maxModels) break
  }
  return out.length > 0 ? out : [fallbackModelId]
}

export function reduceChatGenerationMode(
  state: ChatModelPreferenceState,
  generationMode: ChatGenerationMode,
): ChatModelPreferenceState {
  return { ...state, generationMode }
}

export function reduceSelectedAskModels(
  state: ChatModelPreferenceState,
  selectedAskModelIds: readonly string[],
  fallbackModelId = state.selectedActModelId,
): ChatModelPreferenceState {
  const next = normalizeModelIds(selectedAskModelIds, fallbackModelId)
  return {
    ...state,
    selectedAskModelIds: next,
    selectedActModelId: next[0] ?? state.selectedActModelId,
    selectionMode: next.length > 1 ? 'multiple' : 'single',
  }
}

export function resolveDefaultChatMode(settings: Pick<AppSettings, 'defaultChatMode'>): ChatModePreference {
  return settings.defaultChatMode === 'ask' ? 'ask' : 'act'
}
