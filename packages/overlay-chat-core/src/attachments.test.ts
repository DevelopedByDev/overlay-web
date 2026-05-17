import assert from 'node:assert/strict'
import test from 'node:test'
import {
  LARGE_PASTE_WORD_LIMIT,
  exceedsWordLimit,
  pastedTextFileName,
  shouldAttachPastedTextAsFile,
} from './attachments'

test('large pasted text is classified by word and character thresholds', () => {
  assert.equal(exceedsWordLimit('one two three', 3), false)
  assert.equal(exceedsWordLimit('one two three four', 3), true)
  assert.equal(shouldAttachPastedTextAsFile('short text'), false)
  assert.equal(
    shouldAttachPastedTextAsFile(Array.from({ length: LARGE_PASTE_WORD_LIMIT + 1 }, () => 'word').join(' ')),
    true,
  )
  assert.equal(shouldAttachPastedTextAsFile('x'.repeat(30_001)), true)
})

test('pasted text filenames are stable and filesystem-safe', () => {
  assert.equal(pastedTextFileName(' Quarterly plan: Q1/Q2 '), 'quarterly-plan-q1q2.txt')
  assert.equal(pastedTextFileName('\n\n***\nbody'), 'pasted-text.txt')
  assert.equal(
    pastedTextFileName('A very long title that should be clipped before it can become an unreasonable file name'),
    'a-very-long-title-that-should-be-clipped-before-it-can-become-an.txt',
  )
})
