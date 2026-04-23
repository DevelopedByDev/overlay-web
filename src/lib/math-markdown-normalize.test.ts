import test from 'node:test'
import assert from 'node:assert/strict'

const {
  promoteHeavyInlineMathToFlowBlocks,
  normalizeAssistantMathMarkdown,
} = (await import(new URL('./math-markdown-normalize.ts', import.meta.url).href)) as typeof import('./math-markdown-normalize')

test('promotes heavy one-line $$…$$ after prose to flow math fences', () => {
  const input = 'So R has the form $$\\begin{bmatrix} a \\end{bmatrix}$$ and more.'
  const out = promoteHeavyInlineMathToFlowBlocks(input)
  assert.match(out, /\n\n\$\$\n/)
  assert.match(out, /\n\$\$\n\n/)
  assert.ok(out.includes('\\begin{bmatrix}'))
})

test('does not rewrite normal flow math $$\n…\n$$', () => {
  const input = '$$\nL = x\n$$'
  assert.equal(promoteHeavyInlineMathToFlowBlocks(input), input)
})

test('leaves short inline $$…$$ alone', () => {
  const input = 'Lift ($$C_L$$) is fine.'
  assert.equal(promoteHeavyInlineMathToFlowBlocks(input), input)
})

test('normalizeAssistantMathMarkdown runs delimiter + promotion', () => {
  const input = 'eq $$x + y$$'
  const out = normalizeAssistantMathMarkdown(input)
  assert.equal(out, input)
})
