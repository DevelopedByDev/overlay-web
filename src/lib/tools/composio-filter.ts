import type { ToolSet } from 'ai'
import type { ToolMode } from './types'

/**
 * Composio tool names that are clearly mutating / side-effectful — excluded from Ask mode.
 * Matching is case-insensitive substring on the tool name.
 */
const ASK_COMPOSIO_BLOCK_PATTERNS = [
  'SEND_',
  '_SEND',
  'POST_',
  'CREATE_',
  'DELETE_',
  'UPDATE_',
  'WRITE_',
  'EXEC',
  'SUBMIT_',
  'PUBLISH',
  'COMMIT',
  'TRIGGER_',
  'INVITE',
  'TRANSFER',
  'PAYMENT',
  'CHARGE',
  'BOOK_',
  'ORDER_',
  'PURCHASE',
  'REMOVE_',
  'ARCHIVE',
  'UNSUBSCRIBE',
  'FOLLOW',
  'UNFOLLOW',
  'LIKE_',
  'COMMENT',
  'TWEET',
  'DM_',
]

/**
 * Name hints that suggest read-only retrieval — allowed in Ask when not blocked.
 */
const ASK_COMPOSIO_ALLOW_PATTERNS = [
  'SEARCH',
  'GET_',
  'LIST_',
  'FETCH',
  'READ_',
  'FIND_',
  'LOOKUP',
  'RETRIEVE',
  'QUERY',
  'COMPOSIO_SEARCH_TOOLS',
  'DESCRIBE',
  'PREVIEW',
  'SHOW_',
  'LOAD_',
]

function composioNameBlockedForAsk(name: string): boolean {
  const u = name.toUpperCase()
  return ASK_COMPOSIO_BLOCK_PATTERNS.some((p) => u.includes(p.toUpperCase()))
}

function composioNameAllowedHintForAsk(name: string): boolean {
  const u = name.toUpperCase()
  return ASK_COMPOSIO_ALLOW_PATTERNS.some((p) => u.includes(p.toUpperCase()))
}

/**
 * Ask mode: only Composio tools that look read-only. Act mode: full set.
 * Unknown tools default to **excluded** in Ask (fail closed).
 */
export function filterComposioToolSet(toolSet: ToolSet, mode: ToolMode): ToolSet {
  if (mode === 'act') return toolSet

  const out: ToolSet = {}
  for (const [name, def] of Object.entries(toolSet)) {
    if (!def || typeof def !== 'object') continue
    if (composioNameBlockedForAsk(name)) continue
    if (!composioNameAllowedHintForAsk(name)) continue
    out[name] = def
  }
  return out
}
