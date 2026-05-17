import assert from 'node:assert/strict'
import test from 'node:test'
import { entitlementMeterViewModel, isValidPkceChallenge } from './account'
import { createChatModelPreferenceState, reduceSelectedAskModels } from './chat'
import { normalizeNoteMarkdown } from './notes'

test('chat model preference reducers preserve stable defaults', () => {
  const state = createChatModelPreferenceState({
    defaultAskModelIds: ['a', 'a', 'b', ''],
    defaultActModelId: '',
    fallbackModelId: 'fallback',
  })
  assert.deepEqual(state.selectedAskModelIds, ['a', 'b'])
  assert.equal(state.selectedActModelId, 'a')
  assert.equal(state.selectionMode, 'multiple')

  const next = reduceSelectedAskModels(state, [], 'fallback')
  assert.deepEqual(next.selectedAskModelIds, ['fallback'])
  assert.equal(next.selectionMode, 'single')
})

test('account helpers derive budget state and validate desktop PKCE challenge shape', () => {
  const meter = entitlementMeterViewModel({
    tier: 'pro',
    planKind: 'paid',
    creditsUsed: 0,
    creditsTotal: 0,
    budgetUsedCents: 400,
    budgetTotalCents: 1000,
    dailyUsage: { ask: 0, write: 0, agent: 0 },
  })
  assert.equal(meter.remainingCents, 600)
  assert.equal(meter.percentUsed, 40)
  assert.equal(isValidPkceChallenge('a'.repeat(43)), true)
  assert.equal(isValidPkceChallenge('too-short'), false)
})

test('note markdown normalization keeps text deterministic across platforms', () => {
  assert.equal(normalizeNoteMarkdown('a\r\nb\rc'), 'a\nb\nc')
})
