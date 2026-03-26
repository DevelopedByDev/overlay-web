import { AVAILABLE_MODELS } from '@/lib/models'

export type ComputerCommandCategory =
  | 'session'
  | 'inspect'
  | 'settings'
  | 'tools'
  | 'agents'
  | 'admin'
  | 'media'

export type ComputerCommandExecutionMode = 'local' | 'api' | 'raw-fallback' | 'disabled'

export interface ComputerCommandDescriptor {
  name: string
  aliases?: string[]
  args?: string
  description: string
  category: ComputerCommandCategory
  executionMode: ComputerCommandExecutionMode
  disabledReason?: string
}

export interface ComputerCommandField {
  label: string
  value: string
}

export interface ComputerCommandOption {
  label: string
  value: string
  active?: boolean
}

export interface ComputerCommandTable {
  columns: string[]
  rows: string[][]
}

export type ComputerCommandResult =
  | {
      kind: 'catalog'
      title: string
      sections: Array<{
        label: string
        items: Array<{
          command: string
          description: string
          executionMode: ComputerCommandExecutionMode
          disabledReason?: string
        }>
      }>
    }
  | {
      kind: 'status'
      title: string
      summary: ComputerCommandField[]
      details?: ComputerCommandField[]
      usage?: ComputerCommandField[]
      providerUsage?: ComputerCommandField[]
      session?: ComputerCommandField[]
    }
  | {
      kind: 'identity'
      title: string
      fields: ComputerCommandField[]
    }
  | {
      kind: 'settings'
      title: string
      status: 'success' | 'info' | 'error'
      message: string
      fields: ComputerCommandField[]
      options?: ComputerCommandOption[]
    }
  | {
      kind: 'model'
      title: string
      fields: ComputerCommandField[]
      options: ComputerCommandOption[]
    }
  | {
      kind: 'usage'
      title: string
      fields: ComputerCommandField[]
      tables?: ComputerCommandTable[]
    }
  | {
      kind: 'context'
      title: string
      fields: ComputerCommandField[]
      blocks?: Array<{ label: string; content: string }>
    }
  | {
      kind: 'btw'
      title: string
      question: string
      answer: string
    }
  | {
      kind: 'export'
      title: string
      fields: ComputerCommandField[]
      filename: string
      mimeType: string
      content: string
    }
  | {
      kind: 'admin-table'
      title: string
      fields?: ComputerCommandField[]
      tables: ComputerCommandTable[]
    }
  | {
      kind: 'action'
      title: string
      status: 'success' | 'info' | 'error'
      message: string
      fields?: ComputerCommandField[]
    }
  | {
      kind: 'raw'
      title: string
      markdown: string
    }
  | {
      kind: 'unavailable'
      title: string
      message: string
    }

export interface ParsedComputerCommand {
  descriptor: ComputerCommandDescriptor
  alias: string
  args: string
  raw: string
}

export const COMPUTER_COMMAND_CATEGORY_LABELS: Record<ComputerCommandCategory, string> = {
  session: 'Session',
  inspect: 'Inspect',
  settings: 'Settings',
  tools: 'Tools',
  agents: 'Agents',
  admin: 'Admin',
  media: 'Media',
}

export const COMPUTER_COMMANDS: ComputerCommandDescriptor[] = [
  { name: 'help', aliases: ['commands'], description: 'Show the browser command catalog', category: 'inspect', executionMode: 'local' },
  { name: 'new', args: '[model]', description: 'Start a fresh session', category: 'session', executionMode: 'local' },
  { name: 'stop', description: 'Abort the active run', category: 'session', executionMode: 'api' },
  { name: 'reset', description: 'Reset the current session', category: 'session', executionMode: 'api' },
  { name: 'compact', args: '[instructions]', description: 'Compact the current session', category: 'session', executionMode: 'api' },
  { name: 'status', description: 'Show runtime, model, usage, and queue status', category: 'inspect', executionMode: 'api' },
  { name: 'whoami', aliases: ['id'], description: 'Show the current browser/operator identity', category: 'inspect', executionMode: 'api' },
  { name: 'context', args: '[list|detail|json]', description: 'Inspect what is in context', category: 'inspect', executionMode: 'api' },
  { name: 'btw', args: '<question>', description: 'Ask an ephemeral side question', category: 'tools', executionMode: 'raw-fallback' },
  { name: 'export-session', aliases: ['export'], args: '[path]', description: 'Export the current session', category: 'session', executionMode: 'api' },
  { name: 'model', aliases: ['models'], args: '[name|list|status]', description: 'Inspect or change the active model', category: 'settings', executionMode: 'api' },
  { name: 'think', aliases: ['thinking', 't'], args: '<off|minimal|low|medium|high|xhigh>', description: 'Set the session thinking level', category: 'settings', executionMode: 'api' },
  { name: 'fast', args: '[status|on|off]', description: 'Toggle fast mode', category: 'settings', executionMode: 'api' },
  { name: 'verbose', aliases: ['v'], args: '[on|full|off]', description: 'Toggle verbose output', category: 'settings', executionMode: 'api' },
  { name: 'reasoning', aliases: ['reason'], args: '[on|off|stream]', description: 'Toggle reasoning visibility', category: 'settings', executionMode: 'api' },
  { name: 'elevated', aliases: ['elev'], args: '[on|off|ask|full]', description: 'Adjust elevated execution mode', category: 'settings', executionMode: 'api' },
  { name: 'exec', args: '[host=<...> security=<...> ask=<...> node=<id>]', description: 'Inspect or patch exec defaults', category: 'settings', executionMode: 'api' },
  { name: 'queue', args: '[mode]', description: 'Inspect or change queue settings', category: 'settings', executionMode: 'raw-fallback' },
  { name: 'send', args: '[on|off|inherit]', description: 'Control reply delivery policy', category: 'settings', executionMode: 'api' },
  { name: 'activation', args: '[mention|always]', description: 'Control group activation mode', category: 'settings', executionMode: 'api' },
  { name: 'session', args: 'idle|max-age <duration|off>', description: 'Manage session lifecycle settings', category: 'settings', executionMode: 'raw-fallback' },
  { name: 'usage', args: '[off|tokens|full|cost]', description: 'Inspect or change usage output', category: 'inspect', executionMode: 'api' },
  { name: 'tts', args: '[off|always|inbound|tagged|status|provider|limit|summary|audio]', description: 'Inspect or control TTS settings', category: 'media', executionMode: 'api' },
  { name: 'agents', description: 'List available agents', category: 'agents', executionMode: 'api' },
  { name: 'subagents', args: 'list|kill|log|info|send|steer|spawn', description: 'Inspect or control sub-agents', category: 'agents', executionMode: 'raw-fallback' },
  { name: 'acp', args: 'spawn|cancel|steer|close|status|set-mode|set|cwd|permissions|timeout|model|reset-options|doctor|install|sessions', description: 'Inspect or control ACP sessions', category: 'agents', executionMode: 'raw-fallback' },
  { name: 'kill', args: '<id|#|all>', description: 'Abort running sub-agents', category: 'agents', executionMode: 'raw-fallback' },
  { name: 'steer', args: '<id|#> <message>', description: 'Steer a running sub-agent', category: 'agents', executionMode: 'raw-fallback' },
  { name: 'tell', args: '<id|#> <message>', description: 'Alias for /steer', category: 'agents', executionMode: 'raw-fallback' },
  { name: 'skill', args: '<name> [input]', description: 'Run a skill by name', category: 'tools', executionMode: 'raw-fallback' },
  { name: 'allowlist', description: 'Inspect or edit command allowlists', category: 'admin', executionMode: 'raw-fallback' },
  { name: 'approve', args: '<id> allow-once|allow-always|deny', description: 'Resolve exec approval prompts', category: 'admin', executionMode: 'raw-fallback' },
  { name: 'config', args: 'show|get|set|unset', description: 'Inspect or change OpenClaw config', category: 'admin', executionMode: 'raw-fallback' },
  { name: 'mcp', args: 'show|get|set|unset', description: 'Inspect or change MCP config', category: 'admin', executionMode: 'raw-fallback' },
  { name: 'plugins', aliases: ['plugin'], args: 'list|show|get|enable|disable', description: 'Inspect or toggle plugins', category: 'admin', executionMode: 'raw-fallback' },
  { name: 'debug', args: 'show|set|unset|reset', description: 'Inspect or change runtime overrides', category: 'admin', executionMode: 'raw-fallback' },
  { name: 'restart', description: 'Restart the runtime flow', category: 'admin', executionMode: 'raw-fallback' },
  { name: 'bash', args: '<command>', description: 'Run a host bash command', category: 'tools', executionMode: 'raw-fallback' },
  { name: 'focus', args: '<target>', description: 'Bind a thread to a target session', category: 'session', executionMode: 'disabled', disabledReason: 'Thread-binding commands are not available in the browser computer surface.' },
  { name: 'unfocus', description: 'Remove the active thread binding', category: 'session', executionMode: 'disabled', disabledReason: 'Thread-binding commands are not available in the browser computer surface.' },
  { name: 'voice', args: 'join|leave|status', description: 'Discord voice control', category: 'media', executionMode: 'disabled', disabledReason: 'Discord native voice commands are not available in the browser computer surface.' },
  { name: 'vc', args: 'join|leave|status', description: 'Discord voice control', category: 'media', executionMode: 'disabled', disabledReason: 'Discord native voice commands are not available in the browser computer surface.' },
  { name: 'dock-telegram', aliases: ['dock_telegram'], description: 'Switch replies to Telegram', category: 'media', executionMode: 'disabled', disabledReason: 'Docking commands are channel-specific and not available in the browser computer surface.' },
  { name: 'dock-discord', aliases: ['dock_discord'], description: 'Switch replies to Discord', category: 'media', executionMode: 'disabled', disabledReason: 'Docking commands are channel-specific and not available in the browser computer surface.' },
]

const CATEGORY_ORDER: ComputerCommandCategory[] = ['session', 'inspect', 'settings', 'tools', 'agents', 'admin', 'media']

function normalizeCommandToken(token: string): string {
  return token.trim().replace(/^\/+/, '').toLowerCase()
}

export function getComputerCommandLabel(command: ComputerCommandDescriptor): string {
  return `/${command.name}${command.args ? ` ${command.args}` : ''}`
}

export function parseStandaloneComputerCommand(value: string): ParsedComputerCommand | null {
  const trimmed = value.trim()
  if (!trimmed.startsWith('/')) {
    return null
  }

  const body = trimmed.slice(1)
  const separatorIndex = body.search(/[\s:]/u)
  const rawName = separatorIndex === -1 ? body : body.slice(0, separatorIndex)
  let remainder = separatorIndex === -1 ? '' : body.slice(separatorIndex).trimStart()
  if (remainder.startsWith(':')) {
    remainder = remainder.slice(1).trimStart()
  }

  const normalizedName = normalizeCommandToken(rawName)
  if (!normalizedName) {
    return null
  }

  const descriptor = COMPUTER_COMMANDS.find((entry) =>
    entry.name === normalizedName ||
    entry.aliases?.some((alias) => alias === normalizedName)
  )

  if (!descriptor) {
    return null
  }

  return {
    descriptor,
    alias: normalizedName,
    args: remainder.trim(),
    raw: trimmed,
  }
}

export function getComputerCommandMenuItems(query: string) {
  const normalized = normalizeCommandToken(query)
  const filtered = normalized
    ? COMPUTER_COMMANDS.filter((command) => {
        const label = getComputerCommandLabel(command).toLowerCase()
        const aliases = command.aliases?.join(' ')?.toLowerCase() || ''
        return (
          label.includes(`/${normalized}`) ||
          command.description.toLowerCase().includes(normalized) ||
          aliases.includes(normalized)
        )
      })
    : COMPUTER_COMMANDS

  return [...filtered].sort((a, b) => {
    const categoryDiff = CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category)
    if (categoryDiff !== 0) {
      return categoryDiff
    }
    return a.name.localeCompare(b.name)
  })
}

export function buildComputerCommandCatalogResult(): ComputerCommandResult {
  const sections = CATEGORY_ORDER.map((category) => ({
    label: COMPUTER_COMMAND_CATEGORY_LABELS[category],
    items: COMPUTER_COMMANDS
      .filter((command) => command.category === category)
      .map((command) => ({
        command: getComputerCommandLabel(command),
        description: command.description,
        executionMode: command.executionMode,
        disabledReason: command.disabledReason,
      })),
  })).filter((section) => section.items.length > 0)

  return {
    kind: 'catalog',
    title: 'OpenClaw Commands',
    sections,
  }
}

export function resolveOverlayModelSelection(input: string): string | null {
  const normalized = input.trim().toLowerCase()
  if (!normalized) {
    return null
  }

  const directIndexMatch = normalized.match(/^(\d{1,2})$/)
  if (directIndexMatch) {
    const index = Number(directIndexMatch[1]) - 1
    return AVAILABLE_MODELS[index]?.id ?? null
  }

  const matches = AVAILABLE_MODELS.filter((model) => {
    const haystack = [
      model.id,
      model.name,
      model.provider,
      model.openClawRef,
      `${model.provider}/${model.name}`,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    return haystack.includes(normalized)
  })

  if (matches.length === 1) {
    return matches[0].id
  }

  return AVAILABLE_MODELS.find((model) => model.id.toLowerCase() === normalized)?.id ?? null
}
