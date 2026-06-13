import assert from 'node:assert/strict'
import test from 'node:test'
import type { ConversationRuntime } from '../chat-interface/types'
import { shouldResumeChatStreamIntoAskSlot } from './chatStreamResume'

function runtimeFor(models: string[]): ConversationRuntime {
  const messages = [{ id: 'turn-1', role: 'user', parts: [{ type: 'text', text: 'hello' }] }]
  return {
    askChats: [
      { messages } as never,
      { messages: [] } as never,
      { messages: [] } as never,
      { messages: [] } as never,
    ],
    actChat: { messages } as never,
    hydrated: true,
    ui: {
      selectedActModel: models[0] ?? '',
      selectedModels: models,
      askModelSelectionMode: models.length > 1 ? 'multiple' : 'single',
      exchangeModes: ['act'],
      exchangeModels: [models],
      selectedTabPerExchange: [0],
      activeChatTitle: null,
      generationResults: new Map(),
      exchangeGenTypes: ['text'],
      isFirstMessage: false,
      orphanModelThreads: new Map(),
      lastGeneratedImageUrl: null,
    },
  }
}

test('resumes a single-model turn into the visible act runtime', () => {
  assert.equal(shouldResumeChatStreamIntoAskSlot({
    runtime: runtimeFor(['model-a']),
    turnId: 'turn-1',
    variantIndex: 0,
    activeVariantCount: 1,
  }), false)
})

test('resumes slot zero into the ask runtime for a restored multi-model turn', () => {
  assert.equal(shouldResumeChatStreamIntoAskSlot({
    runtime: runtimeFor(['model-a', 'model-b']),
    turnId: 'turn-1',
    variantIndex: 0,
    activeVariantCount: 1,
  }), true)
})

test('resumes nonzero variants into their ask runtime', () => {
  assert.equal(shouldResumeChatStreamIntoAskSlot({
    runtime: runtimeFor(['model-a']),
    turnId: 'turn-1',
    variantIndex: 2,
    activeVariantCount: 1,
  }), true)
})
