/**
 * Post-process assistant markdown so KaTeX (remark-math) sees math. Weak models often use
 * `[ ... ]` or `( ... )` around TeX instead of `$$...$$`, which does not render.
 *
 * Uses balanced delimiter scanning so inner `\right]`, `\left[`, nested `(`, etc. do not
 * terminate the span too early (the old regex did).
 */

const TEX_COMMAND = /\\[a-zA-Z@]+/

function findMatchingSquareBracketEnd(s: string, openIdx: number): number {
  if (s[openIdx] !== '[') return -1
  let depth = 1
  let i = openIdx + 1
  while (i < s.length && depth > 0) {
    const c = s[i]
    if (c === '[') depth++
    else if (c === ']') depth--
    i++
  }
  return depth === 0 ? i - 1 : -1
}

function findMatchingParenEnd(s: string, openIdx: number): number {
  if (s[openIdx] !== '(') return -1
  let depth = 1
  let i = openIdx + 1
  while (i < s.length && depth > 0) {
    const c = s[i]
    if (c === '(') depth++
    else if (c === ')') depth--
    i++
  }
  return depth === 0 ? i - 1 : -1
}

/** True if `pos` is inside an odd number of `$$` pairs in `s` (naive — counts all `$$` in prefix). */
function isInsideDoubleDollarBlock(s: string, pos: number): boolean {
  const before = s.slice(0, pos)
  const n = (before.match(/\$\$/g) ?? []).length
  return n % 2 === 1
}

/**
 * `[ \\begin{aligned} ... \\right] ... \\end{aligned} ]` and similar — wrap as `$$...$$` when
 * inner text clearly contains TeX commands.
 */
export function normalizeBracketDelimitedLatex(text: string): string {
  if (!text.includes('[') || !text.includes('\\')) return text

  const parts: string[] = []
  let i = 0
  while (i < text.length) {
    const open = text.indexOf('[', i)
    if (open < 0) {
      parts.push(text.slice(i))
      break
    }
    parts.push(text.slice(i, open))
    // Skip `\[ … \]` — keep both `\` and `[`.
    if (open > 0 && text[open - 1] === '\\') {
      parts.push(text.slice(open - 1, open + 1))
      i = open + 1
      continue
    }
    if (isInsideDoubleDollarBlock(text, open)) {
      parts.push('[')
      i = open + 1
      continue
    }

    const close = findMatchingSquareBracketEnd(text, open)
    if (close < 0) {
      parts.push(text.slice(open))
      break
    }

    const inner = text.slice(open + 1, close).trim()
    if (inner.length >= 2 && TEX_COMMAND.test(inner)) {
      parts.push(`$$${inner}$$`)
    } else {
      parts.push(text.slice(open, close + 1))
    }
    i = close + 1
  }
  return parts.join('')
}

/**
 * `(\rho)`, `(\\Re(s)=\\frac12)` — models use parens as fake inline math delimiters.
 * Only rewrites when parentheses are balanced and inner looks like TeX.
 */
export function normalizeParenDelimitedLatex(text: string): string {
  if (!text.includes('(') || !text.includes('\\')) return text

  const parts: string[] = []
  let i = 0
  while (i < text.length) {
    const open = text.indexOf('(', i)
    if (open < 0) {
      parts.push(text.slice(i))
      break
    }
    parts.push(text.slice(i, open))
    // Skip `\(` … `\)` — keep `\(` intact.
    if (open > 0 && text[open - 1] === '\\') {
      parts.push(text.slice(open - 1, open + 1))
      i = open + 1
      continue
    }
    if (isInsideDoubleDollarBlock(text, open)) {
      parts.push('(')
      i = open + 1
      continue
    }

    const close = findMatchingParenEnd(text, open)
    if (close < 0) {
      parts.push(text.slice(open))
      break
    }

    const inner = text.slice(open + 1, close).trim()
    const innerLen = close - open - 1
    // Skip very long spans (likely prose); skip if no TeX command
    if (innerLen > 0 && innerLen < 800 && TEX_COMMAND.test(inner)) {
      parts.push(`$$${inner}$$`)
    } else {
      parts.push(text.slice(open, close + 1))
    }
    i = close + 1
  }
  return parts.join('')
}

/** Run bracket then paren so nested structures and `$$` output stay consistent. */
export function normalizeLatexDelimiters(text: string): string {
  return normalizeParenDelimitedLatex(normalizeBracketDelimitedLatex(text))
}
