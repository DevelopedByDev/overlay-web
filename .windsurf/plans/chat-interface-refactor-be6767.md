# ChatInterface.tsx Refactor Plan

## Goal
Split the 5,132-line `src/components/app/ChatInterface.tsx` into a clean module tree under `src/components/app/chat/`, following clean-architecture principles. **Zero breaking changes** — all existing import paths continue to work.

---

## Target File Structure

```
src/components/app/ChatInterface.tsx          ← becomes a single re-export (no logic)

src/components/app/chat/
  index.tsx                                    ← re-exports ChatInterface as default
  ChatInterface.tsx                            ← main orchestrator (~700 lines after extraction)

  types.ts                                     ← all shared interfaces / type aliases
  constants.ts                                 ← localStorage keys, defaults, sets, static config
  runtime.ts                                   ← ConversationUiState, ConversationRuntime,
                                                  factory + clone functions, createConversationRuntime

  hooks/
    useChatPreferences.ts                      ← localStorage-backed model/mode/generation prefs

  utils/
    message-utils.ts                           ← getMessageText, getMessageImages, getUserTurnId,
                                                  getUserReplyThreadMeta, getUserMessageDocNames,
                                                  splitUserDisplayText, getRoutedModelId,
                                                  getAutomationSuggestion, getDraftFromToolBlock,
                                                  scrollToExchangeTurn
    assistant-visual.ts                        ← AssistantVisualBlock type,
                                                  buildAssistantVisualSequence,
                                                  foldReasoningIntoPrecedingTools,
                                                  assistantBlocksToPlainText,
                                                  ToolVisualBlock / AssistantVisualSegment types,
                                                  buildAssistantVisualSegments, computeToolChainFlags
    tool-labels.ts                             ← getDescriptiveToolLabel, titleCaseUnderscore,
                                                  INTEGRATION_SERVICE_NAMES, TOOL_UI_DONE_STATES,
                                                  serviceNameFromComposioTool, pickFirstStringFromInput,
                                                  describeComposioSearchToolsInput,
                                                  describeComposioIntegrationTool
    media-utils.ts                             ← RestoredOutputGroup, groupOutputsIntoExchanges,
                                                  buildMediaSummary
    chat-utils.ts                              ← resolveActAssistant, generateTitle,
                                                  chatGreetingLine, sanitizeEmptyChatStarters,
                                                  buildSynthesizedThreadForPickerSlot,
                                                  getAssistantAfterUserExchangeIndex,
                                                  cloneUiMessageForThread,
                                                  collectAssistantsForExchangeSorted,
                                                  errorLabel

  components/
    ModelBadges.tsx                            ← model cost/capability badge chips
    FlashCopyIconButton.tsx                    ← animated copy icon button
    DraftSuggestionCard.tsx                    ← inline draft suggestion card
    DraftReviewModal.tsx                       ← automation/skill draft review modal
    MediaSlotOutput.tsx                        ← MediaSlotOutput + MediaCompletedReveal
    MediaExchangeBlock.tsx                     ← image/video exchange block (extracted from render loop)
    ExchangeBlock.tsx                          ← per-turn exchange renderer
    ChatSidebar.tsx                            ← desktop sidebar + mobile slide-up overlay
    ChatComposer.tsx                           ← textarea + toolbar + attachments + reply context
    ChatHeader.tsx                             ← sticky header + model picker + gen-mode toggle

    tool-ui/
      index.ts                                 ← barrel re-export
      ToolLineLogo.tsx                         ← tool brand logo icon
      ToolLogoColumn.tsx                       ← logo column wrapper
      ThinkingShimmerRow.tsx                   ← shimmer row for thinking state
      ToolCallRowWithReasoning.tsx             ← expandable tool call row
      SingleToolCallRow.tsx                    ← simple tool call row
      ToolCallsCollapsedGroup.tsx              ← collapsed group of tool calls
      BrowserToolBlock.tsx                     ← browser tool block with screenshot
```

---

## Backward Compatibility Contract

| Existing path | Resolution |
|---|---|
| `import ChatInterface from '@/components/app/ChatInterface'` | `ChatInterface.tsx` → `export { default } from './chat'` |
| `import ChatInterface from '@/components/app/chat'` | `chat/index.tsx` → `export { default } from './ChatInterface'` |

No other file outside `src/components/app/` imports anything from this module. Confirmed usages:
- `src/app/(app)/chat/page.tsx` — imports `ChatInterface` as default
- `src/components/app/ProjectsView.tsx` — imports `ChatInterface` as default

---

## Content Map — What Moves Where

### `types.ts` (lines from ChatInterface.tsx)
Interfaces/types extracted verbatim (no logic):
- `Conversation` (~line 213)
- `AttachedImage` (~line 221)
- `PendingChatDocument` (~line 226)
- `ChatOutput` (~line 234)
- `Entitlements` (~line 244)
- `GenerationResult` (~line 1684)
- `AskModelSelectionMode` (~line 1692)
- `ChatMessageMetadata` (~line 1006)
- `DraftModalState` (~line 1014)

### `constants.ts`
- `DEFAULT_CHAT_TITLE`, `DEFAULT_MODEL_ID`, `FREE_TIER_AUTO_MODEL_ID` (~line 1647)
- `CHAT_MODEL_KEY`, `ACT_MODEL_KEY`, `ASK_MODEL_SELECTION_MODE_KEY` (~line 1652)
- `CHAT_GEN_MODE_KEY`, `IMAGE_MODEL_SELECTION_MODE_KEY`, `VIDEO_MODEL_SELECTION_MODE_KEY` (~line 1658)
- `SELECTED_IMAGE_MODELS_KEY`, `SELECTED_VIDEO_MODELS_KEY` (~line 1661)
- `SUPPORTED_INPUT_IMAGE_TYPES` Set (~line 1663)
- `IMAGE_MODELS`, `VIDEO_MODELS` arrays (~line 1666)
- `DEFAULT_IMAGE_MODEL_ID`, `DEFAULT_VIDEO_MODEL_ID` (~line 1680)
- `OVERLAY_LOGO_SRC` (~line 411)
- `TOOL_UI_DONE_STATES` Set (~line 407) → or move to `tool-labels.ts`

### `runtime.ts`
- `ConversationUiState` interface (~line 1695)
- `ConversationRuntime` interface (~line 1735)
- `cloneGenerationResultsMap` (~line 1750)
- `cloneOrphanModelThreadsMap` (~line 1757)
- `cloneConversationUiState` (~line 1766)
- `createConversationUiState` (~line 1776)
- `createConversationRuntime` (~line 1796)

### `utils/message-utils.ts`
- `getMessageText` (~line 251)
- `getMessageImages` (~line 989)
- `getUserMessageDocNames` (~line 1018)
- `splitUserDisplayText` (~line 1029)
- `getUserTurnId` (~line 1044)
- `getUserReplyThreadMeta` (~line 1052)
- `getRoutedModelId` (~line 1062)
- `getAutomationSuggestion` (~line 1068)
- `getDraftFromToolBlock` (~line 1075)
- `scrollToExchangeTurn` (~line 1086)

### `utils/assistant-visual.ts`
- `AssistantVisualBlock` type (~line 257)
- `buildAssistantVisualSequence` (~line 262)
- `foldReasoningIntoPrecedingTools` (~line 298)
- `assistantBlocksToPlainText` (~line 318)
- `ToolVisualBlock` type (~line 582)
- `AssistantVisualSegment` type (~line 594)
- `buildAssistantVisualSegmentsRaw` / `mergeConsecutiveToolSegments` / `buildAssistantVisualSegments` (~line 601)
- `isToolChainSegment` / `computeToolChainFlags` (~line 675)

### `utils/tool-labels.ts`
- `TOOL_UI_DONE_STATES`, `OVERLAY_LOGO_SRC`, `pickFirstStringFromInput`, `titleCaseUnderscore`
- `describeComposioSearchToolsInput`, `INTEGRATION_SERVICE_NAMES`, `serviceNameFromComposioTool`
- `describeComposioIntegrationTool`, `getDescriptiveToolLabel` (~lines 407–586)

### `utils/media-utils.ts`
- `RestoredOutputGroup` type (~line 1900)
- `groupOutputsIntoExchanges` (~line 1907)
- `buildMediaSummary` (~line 1960)

### `utils/chat-utils.ts`
- `getAssistantAfterUserExchangeIndex`, `cloneUiMessageForThread`
- `collectAssistantsForExchangeSorted`, `buildSynthesizedThreadForPickerSlot` (~lines 127–208)
- `resolveActAssistant` (~line 1092)
- `generateTitle` (~line 1103)
- `chatGreetingLine`, `sanitizeEmptyChatStarters` (~line 1647)
- `errorLabel` (~line 1479)

### `components/tool-ui/*`
- `ToolLineLogo` (~line 690)
- `ToolLogoColumn` (~line 706)
- `ThinkingShimmerRow` (~line 716)
- `ToolCallRowWithReasoning` (~line 726) — also renders `SingleToolCallRow` internally; can split
- `ToolCallsCollapsedGroup` (~line 879)
- `BrowserToolBlock` (~line 893)

### `components/ModelBadges.tsx`
Lines 67–125.

### `components/DraftSuggestionCard.tsx`
Lines 934–987.

### `components/FlashCopyIconButton.tsx`
Lines 1502–1546.

### `components/DraftReviewModal.tsx`
Lines 1548–1645.

### `components/MediaSlotOutput.tsx`
- `MediaCompletedReveal` (~line 1815)
- `MediaSlotOutput` (~line 1870)

### `components/MediaExchangeBlock.tsx`
Extracted from the inline `if (genType === 'image' || genType === 'video')` branch (~lines 4544–4668) inside the main render loop. Props:
```ts
interface MediaExchangeBlockProps {
  msg: UIMessage
  exchIdx: number
  genType: 'image' | 'video'
  exchModelList: string[]
  allResults: GenerationResult[]
  exitingTurnIds: string[]
  onDelete: (turnId: string) => void
  onReply: (prompt: string, kind: 'image' | 'video', turnId: string | null) => void
  onJumpToReply: (turnId: string) => void
}
```

### `components/ExchangeBlock.tsx`
Lines 1132–1477. Already a self-contained sub-component; just moves to its own file. Existing props interface is preserved verbatim.

### `components/ChatSidebar.tsx`
Desktop sidebar (lines 4058–4138) and mobile overlay (lines 4140–4255) extracted into one component.
Props:
```ts
interface ChatSidebarProps {
  chats: Conversation[]
  activeChatId: string | null
  sessions: Record<string, { status: string }>
  getUnread: (id: string) => number
  editingChatId: string | null
  editingChatTitle: string
  mobileChatListOpen: boolean
  onLoadChat: (id: string) => void
  onNewChat: () => void
  onBeginRename: (id: string, title: string, e: React.MouseEvent) => void
  onCommitRename: (id: string) => Promise<void>
  onCancelRename: () => void
  onDeleteChat: (id: string, e: React.MouseEvent) => void
  onSetEditingChatTitle: (t: string) => void
  onSetMobileChatListOpen: (v: boolean) => void
}
```

### `components/ChatHeader.tsx`
Lines 4302–4525. Props:
```ts
interface ChatHeaderProps {
  activeChatTitle: string | null
  activeChat: Conversation | undefined
  isSwitchingChat: boolean
  projectName: string | null
  generationMode: GenerationMode
  composerMode: 'ask' | 'act'
  isActiveLoading: boolean
  selectedModels: string[]
  selectedActModel: string
  selectedImageModels: string[]
  selectedVideoModels: string[]
  askModelSelectionMode: AskModelSelectionMode
  imageModelSelectionMode: AskModelSelectionMode
  videoModelSelectionMode: AskModelSelectionMode
  isFreeTier: boolean
  showModelPicker: boolean
  hoveredModelId: string | null
  modelPickerLabel: string
  modelPickerRef: React.RefObject<HTMLDivElement>
  onModelPickerToggle: (v: boolean) => void
  onHoveredModelChange: (id: string | null) => void
  onModeChange: (mode: GenerationMode) => void
  onAskSelectionModeChange: (m: AskModelSelectionMode) => void
  onImageSelectionModeChange: (m: AskModelSelectionMode) => void
  onVideoSelectionModeChange: (m: AskModelSelectionMode) => void
  onToggleModel: (id: string) => void
  onToggleImageModel: (id: string) => void
  onToggleVideoModel: (id: string) => void
  onSelectActModel: (id: string) => void
}
```

### `components/ChatComposer.tsx`
Lines 4802–5103 (the `<div className="flex flex-col ...">` wrapping the input area). Props:
```ts
interface ChatComposerProps {
  input: string
  onInputChange: (v: string) => void
  onSend: () => void
  onStop: () => void
  isActiveLoading: boolean
  isSendBlocked: boolean
  premiumModelBlocked: boolean
  showCenteredEmptyChat: boolean
  composerMode: 'ask' | 'act'
  generationMode: GenerationMode
  generationChip: 'image' | 'video' | null
  onComposerModeChange: (m: 'ask' | 'act') => void
  onModeChange: (m: GenerationMode) => void
  onGenerationChipClear: () => void
  replyContext: { snippet: string; bodyForModel: string; replyToTurnId?: string } | null
  onClearReplyContext: () => void
  attachedImages: AttachedImage[]
  onRemoveImage: (idx: number) => void
  pendingChatDocuments: PendingChatDocument[]
  onRemoveDocument: (clientId: string) => void
  attachmentError: string | null
  composerNotice: string | null
  supportsVision: boolean
  textareaRef: React.RefObject<HTMLTextAreaElement>
  fileInputRef: React.RefObject<HTMLInputElement>
  docInputRef: React.RefObject<HTMLInputElement>
  onAddImages: (files: FileList | File[]) => void
  onAddDocuments: (files: FileList | File[] | null) => void
  onPaste: (e: React.ClipboardEvent) => void
  greetingLine: string
  emptyChatStarters: string[]
  onStarterClick: (prompt: string) => void
}
```

### `hooks/useChatPreferences.ts`
Manages all localStorage-backed preferences. Returns current values + setters. Reads initial values from localStorage on mount.

Returned values:
- `selectedModels`, `setSelectedModels`
- `selectedActModel`, `setSelectedActModel`
- `askModelSelectionMode`, `setAskModelSelectionMode`
- `generationMode`, `setGenerationMode`
- `imageModelSelectionMode`, `setImageModelSelectionMode`
- `videoModelSelectionMode`, `setVideoModelSelectionMode`
- `selectedImageModels`, `setSelectedImageModels`
- `selectedVideoModels`, `setSelectedVideoModels`

Each setter also writes to the corresponding localStorage key.

---

## Migration Steps (Ordered for Safety)

Execute top-down: pure utilities first, then components, then the main file last.

```
Step  File(s) created/modified                    Source lines in ChatInterface.tsx
───────────────────────────────────────────────────────────────────────────────────
1     chat/types.ts                                ~213–248, ~1006–1018, ~1684–1693
2     chat/constants.ts                            ~407–411, ~1647–1683
3     chat/runtime.ts                              ~1695–1813
4     chat/utils/message-utils.ts                  ~251, ~989–1095
5     chat/utils/assistant-visual.ts               ~257–407, ~582–690
6     chat/utils/tool-labels.ts                    ~407–586
7     chat/utils/media-utils.ts                    ~1900–1970
8     chat/utils/chat-utils.ts                     ~127–208, ~1092–1130, ~1479, ~1647
9     chat/components/tool-ui/*                    ~690–932
10    chat/components/ModelBadges.tsx               ~67–125
11    chat/components/DraftSuggestionCard.tsx       ~934–987
12    chat/components/FlashCopyIconButton.tsx       ~1502–1546
13    chat/components/DraftReviewModal.tsx          ~1548–1645
14    chat/components/MediaSlotOutput.tsx           ~1815–1900
15    chat/components/MediaExchangeBlock.tsx        ~4544–4668 (render-loop inline)
16    chat/components/ExchangeBlock.tsx             ~1132–1477
17    chat/components/ChatSidebar.tsx               ~4056–4256 (render-loop inline)
18    chat/components/ChatHeader.tsx                ~4302–4525 (render-loop inline)
19    chat/components/ChatComposer.tsx              ~4802–5103 (render-loop inline)
20    chat/hooks/useChatPreferences.ts              ~2085–2150 (state declarations)
21    chat/ChatInterface.tsx                        remaining orchestration logic
22    chat/index.tsx                                new (1-line re-export)
23    components/app/ChatInterface.tsx              replace body with re-export
```

---

## Rules for Each Step

1. **Copy, don't transform** — paste the source verbatim, then adjust imports only.
2. **Imports first** — all `import` statements must appear at the top of each new file.
3. **One file per step** — complete and verify one file before moving on.
4. **No logic changes** — handlers, conditions, and JSX remain identical; only file boundaries move.
5. **Preserve all existing type annotations** — no `any` additions.
6. **After step 23**, run `tsc --noEmit` to catch any missed imports or type errors before committing.

---

## Risk Register

| Risk | Mitigation |
|---|---|
| Circular imports (e.g., `ExchangeBlock` ↔ `utils`) | Dependency arrows are one-directional: utils → types, components → utils → types |
| Missing re-exports cause 404s at runtime | Preserve original `ChatInterface.tsx` as a re-export (step 23) |
| `useChatPreferences` hook called outside the component tree | Hook is used only inside `ChatInterface.tsx` |
| `ExchangeBlock` closes over ChatInterface state | ExchangeBlock already uses only its own props — no closure state |
| `ChatSidebar`/`ChatHeader`/`ChatComposer` prop explosions | All props typed explicitly; consider `React.memo` on each after extraction |

---

## Size Estimates After Refactor

| File | Estimated lines |
|---|---|
| `ChatInterface.tsx` (orchestrator) | ~700 |
| `ExchangeBlock.tsx` | ~350 |
| `ChatComposer.tsx` | ~310 |
| `ChatHeader.tsx` | ~225 |
| `ChatSidebar.tsx` | ~200 |
| `MediaExchangeBlock.tsx` | ~130 |
| `assistant-visual.ts` | ~200 |
| `tool-labels.ts` | ~180 |
| Each tool-ui component | 30–120 |
| types/constants/runtime | 60–120 each |
| utils/* | 40–100 each |

Total file count added: **~30 new files**. The original `ChatInterface.tsx` drops from 5,132 lines to ~3 (a re-export).
