import test from 'node:test'
import assert from 'node:assert/strict'

// @ts-expect-error - Node's strip-types runner needs the .ts specifier here.
import { createNotebookTextEmitter } from './notebook-agent-stream.ts'

test('dedupes repeated notebook agent text emissions', () => {
  const emitted: string[] = []
  const emitText = createNotebookTextEmitter((text) => emitted.push(text))

  assert.equal(emitText('Done. Summary.'), true)
  assert.equal(emitText('Done. Summary.'), false)
  assert.equal(emitText('Done. Summary.\n'), false)
  assert.equal(emitText('Different summary.'), true)

  assert.deepEqual(emitted, ['Done. Summary.', 'Different summary.'])
})
