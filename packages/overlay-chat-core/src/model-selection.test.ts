import assert from 'node:assert/strict'
import test from 'node:test'
import {
  collapseModelSelection,
  resolvePrimaryModel,
  selectSingleModel,
  toggleModelSelection,
} from './model-selection'

test('single mode replaces the selected model', () => {
  assert.deepEqual(selectSingleModel('claude', ['gpt']), ['claude'])
  assert.deepEqual(
    toggleModelSelection({ current: ['gpt'], modelId: 'claude', mode: 'single' }),
    ['claude'],
  )
})

test('multiple mode toggles models while keeping at least one selected', () => {
  assert.deepEqual(
    toggleModelSelection({ current: ['gpt'], modelId: 'claude', mode: 'multiple' }),
    ['gpt', 'claude'],
  )
  assert.deepEqual(
    toggleModelSelection({ current: ['gpt'], modelId: 'gpt', mode: 'multiple' }),
    ['gpt'],
  )
})

test('multiple mode enforces the max selected limit', () => {
  assert.deepEqual(
    toggleModelSelection({
      current: ['a', 'b', 'c', 'd'],
      modelId: 'e',
      mode: 'multiple',
      maxSelected: 4,
    }),
    ['a', 'b', 'c', 'd'],
  )
})

test('selection helpers collapse and resolve primary models', () => {
  assert.deepEqual(collapseModelSelection(['a', 'b']), ['a'])
  assert.deepEqual(collapseModelSelection([]), [])
  assert.equal(resolvePrimaryModel(['a', 'b'], 'fallback'), 'a')
  assert.equal(resolvePrimaryModel([], 'fallback'), 'fallback')
})
