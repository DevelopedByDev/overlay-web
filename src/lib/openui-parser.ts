/**
 * Minimal OpenUI Lang parser.
 *
 * Grammar (subset):
 *   statement  ::= identifier "=" expr
 *   expr       ::= ComponentName "(" args ")"
 *   args       ::= arg ("," arg)*
 *   arg        ::= string | array | identifier
 *   string     ::= '"' .* '"'
 *   array      ::= "[" (identifier ("," identifier)*)? "]"
 *
 * The first statement must assign to `root`.
 */

export type OpenUIArg = string | OpenUIArg[] | OpenUINode | null

export interface OpenUINode {
  component: string
  args: OpenUIArg[]
}

export type OpenUIDefinitions = Map<string, OpenUINode>

/**
 * Parse OpenUI Lang text into a definitions map.
 * Returns null if the text doesn't look like valid OpenUI Lang.
 */
export function parseOpenUILang(text: string): { root: OpenUINode; defs: OpenUIDefinitions } | null {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  if (lines.length === 0) return null

  const defs: OpenUIDefinitions = new Map()
  let hasRoot = false

  for (const line of lines) {
    // Skip comment lines
    if (line.startsWith('#') || line.startsWith('//')) continue

    const eqIdx = line.indexOf('=')
    if (eqIdx === -1) continue

    const identifier = line.slice(0, eqIdx).trim()
    const exprStr = line.slice(eqIdx + 1).trim()
    if (!identifier || !exprStr) continue

    const node = parseExpr(exprStr)
    if (!node) continue

    defs.set(identifier, node)
    if (identifier === 'root') hasRoot = true
  }

  if (!hasRoot) return null
  const root = defs.get('root')!
  return { root, defs }
}

function parseExpr(str: string): OpenUINode | null {
  const parenIdx = str.indexOf('(')
  if (parenIdx === -1) return null

  const component = str.slice(0, parenIdx).trim()
  if (!component || !/^[A-Z]/.test(component)) return null

  // Find matching closing paren
  const inner = str.slice(parenIdx + 1)
  const closeParen = findMatchingParen(inner)
  if (closeParen === -1) return null

  const argsStr = inner.slice(0, closeParen).trim()
  const args = parseArgs(argsStr)

  return { component, args }
}

function findMatchingParen(str: string): number {
  let depth = 0
  let inString = false
  let i = 0
  for (; i < str.length; i++) {
    const ch = str[i]
    if (ch === '"' && str[i - 1] !== '\\') {
      inString = !inString
    }
    if (!inString) {
      if (ch === '(' || ch === '[') depth++
      else if (ch === ')' || ch === ']') {
        if (depth === 0) return i
        depth--
      }
    }
  }
  return -1
}

function parseArgs(str: string): OpenUIArg[] {
  if (!str.trim()) return []

  const args: OpenUIArg[] = []
  let i = 0

  while (i < str.length) {
    // Skip whitespace
    while (i < str.length && str[i] === ' ') i++
    if (i >= str.length) break

    const ch = str[i]

    if (ch === '"') {
      // String literal
      let j = i + 1
      while (j < str.length && !(str[j] === '"' && str[j - 1] !== '\\')) j++
      args.push(str.slice(i + 1, j))
      i = j + 1
    } else if (ch === '[') {
      // Array of identifiers
      let depth = 1
      let j = i + 1
      while (j < str.length && depth > 0) {
        if (str[j] === '[') depth++
        else if (str[j] === ']') depth--
        j++
      }
      const innerArr = str.slice(i + 1, j - 1).trim()
      const refs = innerArr ? innerArr.split(',').map((r) => r.trim()).filter(Boolean) : []
      args.push(refs)
      i = j
    } else if (/[a-zA-Z_]/.test(ch)) {
      // Identifier (forward reference)
      let j = i
      while (j < str.length && /\w/.test(str[j])) j++
      args.push(str.slice(i, j))
      i = j
    } else {
      i++
    }

    // Skip comma
    while (i < str.length && (str[i] === ',' || str[i] === ' ')) i++
  }

  return args
}

/**
 * Detect if a text block is likely OpenUI Lang.
 * Heuristic: starts with `root = SomeComponent(` within the first 3 non-empty lines.
 */
export function isOpenUILang(text: string): boolean {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  for (let i = 0; i < Math.min(lines.length, 3); i++) {
    if (/^root\s*=\s*[A-Z]/.test(lines[i])) return true
  }
  return false
}

/**
 * Resolve an arg to its final node using the defs map.
 * If the arg is a string identifier that maps to a node, return that node.
 */
export function resolveArg(arg: OpenUIArg, defs: OpenUIDefinitions): OpenUINode | string | OpenUIArg[] | null {
  if (typeof arg === 'string') {
    // Could be a forward ref or a plain string value
    const resolved = defs.get(arg)
    return resolved ?? arg
  }
  if (Array.isArray(arg)) return arg
  if (arg && typeof arg === 'object') return arg
  return null
}
