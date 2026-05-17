import { INTEGRATION_SERVICE_NAMES } from '@overlay/chat-core'

/** Human-readable labels for assistant tool rows (aligned with web ChatInterface). */

export function pickFirstStringFromInput(input: Record<string, unknown> | undefined, keys: string[]): string | null {
  if (!input) return null
  for (const k of keys) {
    const v = input[k]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return null
}

export function titleCaseUnderscore(id: string): string {
  return id
    .trim()
    .split(/_+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

function describeComposioSearchToolsInput(input?: Record<string, unknown>): string | null {
  if (!input) return null
  const hint =
    pickFirstStringFromInput(input, ['use_case', 'intent', 'description', 'goal', 'task']) ??
    (typeof input.query === 'string' ? input.query : null)
  if (hint) {
    const clipped = hint.length > 120 ? `${hint.slice(0, 120)}…` : hint
    return `Finding the right tools — ${clipped}`
  }
  const queries = input.queries
  if (Array.isArray(queries) && queries.length && typeof queries[0] === 'string' && queries[0].trim()) {
    const query = queries[0]!.trim()
    const clipped = query.length > 80 ? `${query.slice(0, 80)}…` : query
    return `Searching apps for “${clipped}”`
  }
  return null
}

function serviceNameFromComposioTool(toolName: string): string | null {
  const upper = toolName.toUpperCase()
  const keys = Object.keys(INTEGRATION_SERVICE_NAMES).sort((a, b) => b.length - a.length)
  for (const prefix of keys) {
    if (upper.startsWith(`${prefix}_`)) {
      return INTEGRATION_SERVICE_NAMES[prefix] ?? null
    }
  }
  return null
}

function describeComposioIntegrationTool(toolName: string, input?: Record<string, unknown>): string {
  const service = serviceNameFromComposioTool(toolName)
  const upper = toolName.toUpperCase()
  const query =
    input &&
    pickFirstStringFromInput(input, [
      'query',
      'search_query',
      'q',
      'search',
      'prompt',
      'message',
      'subject',
      'body',
      'text',
    ])

  if (service) {
    if (query && (upper.includes('SEARCH') || upper.includes('FIND') || upper.includes('QUERY') || upper.includes('LIST_MESSAGE'))) {
      const clipped = query.length > 56 ? `${query.slice(0, 56)}…` : query
      return `Searching ${service} for “${clipped}”`
    }
    if (/(SEND|POST|CREATE_MESSAGE|REPLY)/.test(upper) && upper.includes('MAIL')) return `Sending mail in ${service}`
    if (/(SEND|POST|MESSAGE)/.test(upper) && upper.includes('SLACK')) return `Sending a message in ${service}`
    if (/(CREATE_EVENT|ADD_EVENT|INSERT_EVENT|SCHEDULE)/.test(upper)) return `Scheduling an event in ${service}`
    if (/(LIST_MESSAGES|FETCH|INBOX|THREAD)/.test(upper) && upper.includes('GMAIL')) return `Reading mail in ${service}`
    if (/(LIST_EVENT|GET_EVENT|SEARCH_EVENT|FIND_EVENT|FREE_BUSY|AVAILABILITY)/.test(upper)) return `Looking at events in ${service}`
    if (/(UPDATE_EVENT|PATCH_EVENT|EDIT_EVENT)/.test(upper)) return `Updating an event in ${service}`
    if (/(DELETE_EVENT|REMOVE_EVENT|CANCEL_EVENT)/.test(upper)) return `Updating calendar in ${service}`
    if (/(CREATE|ADD|NEW)/.test(upper) && !/(CREATE_EVENT)/.test(upper)) return `Creating in ${service}`
    if (/(UPDATE|EDIT|PATCH)/.test(upper)) return `Updating ${service}`
    if (/(DELETE|REMOVE)/.test(upper)) return `Deleting in ${service}`
    if (/(LIST|SEARCH|FETCH|GET|FIND|QUERY|READ)/.test(upper)) return `Searching ${service}`
    return `Using ${service}`
  }

  if (upper.includes('MULTI_EXECUTE')) return 'Running connected app actions'
  if (upper.includes('SEARCH_TOOLS')) {
    return describeComposioSearchToolsInput(input) ?? 'Finding the right tools for your task'
  }

  return titleCaseUnderscore(toolName.replace(/^composio_/i, ''))
}

export function getDescriptiveToolLabel(toolName: string, toolInput?: Record<string, unknown>): string {
  const map: Record<string, string> = {
    browser_run_task: 'Browsing the web',
    interactive_browser_session: 'Browsing the web',
    perplexity_search: 'Searching the web',
    parallel_search: 'Deep web research',
    search_knowledge: 'Searching your knowledge',
    list_skills: 'Checking your skills',
    list_notes: 'Listing your notes',
    get_note: 'Opening a note',
    create_note: 'Creating a note',
    update_note: 'Updating a note',
    delete_note: 'Deleting a note',
    save_memory: 'Saving to memory',
    update_memory: 'Updating memory',
    delete_memory: 'Deleting memory',
    generate_image: 'Generating an image',
    generate_video: 'Generating a video',
    run_daytona_sandbox: 'Running your workspace',
  }
  if (map[toolName]) return map[toolName]!

  if (toolName === 'COMPOSIO_SEARCH_TOOLS') {
    return describeComposioSearchToolsInput(toolInput) ?? 'Finding the right tools for your task'
  }

  if (/composio|GMAIL_|GOOGLE_|SLACK_|NOTION_|GITHUB_|LINEAR_|OUTLOOK_|CAL_COM/i.test(toolName)) {
    return describeComposioIntegrationTool(toolName, toolInput)
  }

  if (toolName === 'perplexity_search' && toolInput) {
    const q = pickFirstStringFromInput(toolInput, ['query', 'q'])
    if (q) {
      const clipped = q.length > 72 ? `${q.slice(0, 72)}…` : q
      return `Searching the web for “${clipped}”`
    }
  }

  if (toolName === 'parallel_search' && toolInput) {
    const objective = pickFirstStringFromInput(toolInput, ['objective'])
    if (objective) {
      const clipped = objective.length > 72 ? `${objective.slice(0, 72)}…` : objective
      return `Researching: “${clipped}”`
    }
  }

  if (toolName.startsWith('mcp_')) {
    const rest = toolName.slice(4)
    const firstUnderscore = rest.indexOf('_')
    if (firstUnderscore > 0) {
      const serverSlug = rest.slice(0, firstUnderscore)
      const toolSlug = rest.slice(firstUnderscore + 1)
      return `${titleCaseUnderscore(serverSlug)} MCP: ${titleCaseUnderscore(toolSlug)}`
    }
  }

  return titleCaseUnderscore(toolName)
}
