import type { ChatMessageMetadata, ConversationRuntime } from '../chat-interface/types'

type CompleteSession = (chatId: string, active: boolean) => void
type RefreshAfterTurn = () => void | Promise<void>

export interface StartActTextStreamParams {
  chatId: string
  targetRuntime: ConversationRuntime
  textModelsForTurn: string[]
  textSlotCount: number
  selectedActModel: string
  turnId: string
  partsForModel: Array<{ type: string; text?: string; url?: string; mediaType?: string }>
  userMetadata?: ChatMessageMetadata
  commonBody: Record<string, unknown>
  isChatActive: (chatId: string) => boolean
  completeSession: CompleteSession
  loadChats: RefreshAfterTurn
  loadSubscription: RefreshAfterTurn
  onError: (error: unknown, fallbackMessage: string) => void
  logPrefix: string
}

function finishTextTurn(params: Pick<
  StartActTextStreamParams,
  'chatId' | 'isChatActive' | 'completeSession' | 'loadChats' | 'loadSubscription'
>) {
  params.completeSession(params.chatId, params.isChatActive(params.chatId))
  void params.loadChats()
  void params.loadSubscription()
}

function failTextTurn(
  params: Pick<StartActTextStreamParams, 'chatId' | 'isChatActive' | 'completeSession' | 'onError' | 'logPrefix'>,
  error: unknown,
  fallbackMessage: string,
) {
  console.error(`[ChatInterface] ${params.logPrefix} sendMessage failed`, error)
  params.completeSession(params.chatId, params.isChatActive(params.chatId))
  if (params.isChatActive(params.chatId)) {
    params.onError(error, fallbackMessage)
  }
}

export function startActTextStream(params: StartActTextStreamParams) {
  const multiText = params.textModelsForTurn.length > 1

  /* eslint-disable @typescript-eslint/no-explicit-any -- AI SDK UIMessage payload */
  if (multiText) {
    const sends = params.textModelsForTurn.map((modelId, slotIdx) =>
      params.targetRuntime.askChats[slotIdx]!.sendMessage(
        {
          role: 'user',
          parts: params.partsForModel as any,
          messageId: params.turnId,
          ...(params.userMetadata ? { metadata: params.userMetadata } : {}),
        } as any,
        {
          body: {
            ...params.commonBody,
            modelId,
            multiModelSlotIndex: slotIdx,
            multiModelTotal: params.textSlotCount,
          },
        },
      ),
    )
    void Promise.all(sends)
      .then(() => {
        params.targetRuntime.actChat.messages = [...params.targetRuntime.askChats[0]!.messages]
        finishTextTurn(params)
      })
      .catch((error) => {
        failTextTurn(params, error, 'Could not complete Act request. Try again.')
      })
    return
  }

  void params.targetRuntime.actChat
    .sendMessage(
      {
        role: 'user',
        parts: params.partsForModel as any,
        messageId: params.turnId,
        ...(params.userMetadata ? { metadata: params.userMetadata } : {}),
      } as any,
      {
        body: {
          ...params.commonBody,
          modelId: params.selectedActModel,
        },
      },
    )
    .then(() => {
      finishTextTurn(params)
    })
    .catch((error) => {
      failTextTurn(params, error, 'Could not complete Act request. Try again.')
    })
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

export function startActRetryStream(params: StartActTextStreamParams) {
  const retrySlots = params.textSlotCount
  const multiRetry = params.textModelsForTurn.length > 1

  /* eslint-disable @typescript-eslint/no-explicit-any -- AI SDK UIMessage payload */
  if (multiRetry) {
    const sends = params.textModelsForTurn.slice(0, retrySlots).map((modelId, slotIdx) =>
      params.targetRuntime.askChats[slotIdx]!.sendMessage(
        {
          role: 'user',
          parts: params.partsForModel as any,
          messageId: params.turnId,
          ...(params.userMetadata && Object.keys(params.userMetadata).length > 0
            ? { metadata: params.userMetadata }
            : {}),
        } as any,
        {
          body: {
            ...params.commonBody,
            modelId,
            multiModelSlotIndex: slotIdx,
            multiModelTotal: retrySlots,
          },
        },
      ),
    )
    void Promise.all(sends)
      .then(() => {
        params.targetRuntime.actChat.messages = [...params.targetRuntime.askChats[0]!.messages]
        finishTextTurn(params)
      })
      .catch((error) => {
        failTextTurn(params, error, 'Could not retry. Try again.')
      })
    return
  }

  void params.targetRuntime.actChat
    .sendMessage(
      {
        role: 'user',
        parts: params.partsForModel as any,
        messageId: params.turnId,
        ...(params.userMetadata && Object.keys(params.userMetadata).length > 0
          ? { metadata: params.userMetadata }
          : {}),
      } as any,
      {
        body: {
          ...params.commonBody,
          modelId: params.selectedActModel,
        },
      },
    )
    .then(() => {
      finishTextTurn(params)
    })
    .catch((error) => {
      failTextTurn(params, error, 'Could not retry. Try again.')
    })
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

export function reportTextStreamError(
  setComposerNotice: (notice: string | null | ((current: string | null) => string | null)) => void,
  error: unknown,
  fallbackMessage: string,
) {
  setComposerNotice(error instanceof Error ? error.message : fallbackMessage)
  window.setTimeout(() => setComposerNotice(null), 8000)
}
