import test from 'node:test'
import assert from 'node:assert/strict'

const {
  promoteHeavyInlineMathToFlowBlocks,
  normalizeDoubleDollarMath,
  normalizeEscapedLatexDelimiters,
  normalizeBareBigONotation,
  normalizeBareLatexLines,
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

test('converts short inline $$…$$ to standard inline math', () => {
  const input = 'Lift ($$C_L$$) is fine.'
  assert.equal(normalizeDoubleDollarMath(input), 'Lift ($C_L$) is fine.')
})

test('keeps heavy inline $$…$$ as display math fences', () => {
  const input = 'So R has the form $$\\begin{bmatrix} a \\\\ b \\end{bmatrix}$$ and more.'
  const out = normalizeDoubleDollarMath(input)
  assert.match(out, /\n\n\$\$\n/)
  assert.match(out, /\n\$\$\n\n/)
  assert.ok(out.includes('\\begin{bmatrix}'))
})

test('repairs stray double-dollar opener before a TeX atom', () => {
  const input = 'different $$\\Sigma estimates, different constraints'
  assert.equal(normalizeDoubleDollarMath(input), 'different $\\Sigma$ estimates, different constraints')
})

test('repairs stray double-dollar closer after a compact TeX expression', () => {
  const input = 'Factor the 4 \\times 4$$ matrix once via LU.'
  assert.equal(normalizeDoubleDollarMath(input), 'Factor the $4 \\times 4$ matrix once via LU.')
})

test('accepts escaped TeX delimiters from models', () => {
  assert.equal(normalizeEscapedLatexDelimiters('Use \\(x^2\\) here.'), 'Use $x^2$ here.')
  assert.equal(normalizeEscapedLatexDelimiters('Then \\[x^2\\]'), 'Then \n\n$$\nx^2\n$$\n\n')
})

test('wraps bare Big-O notation outside existing math', () => {
  const input = 'Costs O(n^3/3), then $O(n^2)$ and `O(n)`.'
  assert.equal(normalizeBareBigONotation(input), 'Costs $O(n^3/3)$, then $O(n^2)$ and `O(n)`.')
})

test('promotes raw matrix assignment lines to display math', () => {
  const input = 'where:\nL = \\begin{bmatrix} 1 & 0 \\\\ l_{21} & 1 \\end{bmatrix}, \\quad U = \\begin{bmatrix} u_{11} & u_{12} \\\\ 0 & u_{22} \\end{bmatrix}'
  const out = normalizeBareLatexLines(input)
  assert.match(out, /where:\n\n\$\$\nL = \\begin\{bmatrix\}/)
  assert.match(out, /\\quad U = \\begin\{bmatrix\}/)
  assert.match(out, /\n\$\$/)
})

test('promotes raw Doolittle formula tail after prose prefix', () => {
  const input = '2. The formulas: U_{i,j} = A_{i,j} - \\sum_{k=1}^{j-1} L_{i,k} U_{k,j} \\quad \\text{for } i \\le j'
  const out = normalizeBareLatexLines(input)
  assert.equal(
    out,
    '2. The formulas:\n\n$$\nU_{i,j} = A_{i,j} - \\sum_{k=1}^{j-1} L_{i,k} U_{k,j} \\quad \\text{for } i \\le j\n$$\n',
  )
})

test('normalizeAssistantMathMarkdown runs delimiter + promotion', () => {
  const input = 'eq $$x + y$$'
  const out = normalizeAssistantMathMarkdown(input)
  assert.equal(out, 'eq $x + y$')
})
