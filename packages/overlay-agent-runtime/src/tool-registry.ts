import type { ToolDefinition, ToolResult } from '@overlay/tools-core'

type SafeParseResult =
  | { success: true; data: unknown }
  | { success: false; error: unknown }

type ParsableSchema = {
  safeParse?: (input: unknown) => SafeParseResult
  parse?: (input: unknown) => unknown
}

function isAllowed(toolId: string, allowedToolIds?: readonly string[] | ReadonlySet<string> | null): boolean {
  if (!allowedToolIds) return true
  const maybeSet = allowedToolIds as ReadonlySet<string>
  if (typeof maybeSet.has === 'function') return maybeSet.has(toolId)
  return (allowedToolIds as readonly string[]).includes(toolId)
}

function validateWithSchema(schema: unknown, input: unknown): unknown {
  if (!schema || typeof schema !== 'object') return input
  const parsable = schema as ParsableSchema
  if (typeof parsable.safeParse === 'function') {
    const result = parsable.safeParse(input)
    if (!result.success) {
      throw new Error(`[tools] Tool input failed validation: ${String(result.error)}`)
    }
    return result.data
  }
  if (typeof parsable.parse === 'function') {
    return parsable.parse(input)
  }
  return input
}

export class ToolRegistry {
  private readonly tools = new Map<string, ToolDefinition>()

  constructor(initialTools: readonly ToolDefinition[] = []) {
    for (const definition of initialTools) {
      this.register(definition)
    }
  }

  register(definition: ToolDefinition): this {
    if (!definition.id) {
      throw new Error('[tools] Tool definition must include an id')
    }
    if (this.tools.has(definition.id)) {
      throw new Error(`[tools] Tool "${definition.id}" is already registered`)
    }
    this.tools.set(definition.id, definition)
    return this
  }

  get(toolId: string): ToolDefinition | undefined {
    return this.tools.get(toolId)
  }

  list(): readonly ToolDefinition[] {
    return Array.from(this.tools.values())
  }

  validateCall(args: {
    toolId: string
    input: unknown
    allowedToolIds?: readonly string[] | ReadonlySet<string> | null
  }): unknown {
    const definition = this.tools.get(args.toolId)
    if (!definition) {
      throw new Error(`[tools] Tool "${args.toolId}" is not registered`)
    }
    if (!isAllowed(args.toolId, args.allowedToolIds)) {
      throw new Error(`[tools] Tool "${args.toolId}" is not exposed for this turn`)
    }
    return validateWithSchema(definition.inputSchema, args.input)
  }

  async execute(args: {
    toolId: string
    input: unknown
    context?: unknown
    allowedToolIds?: readonly string[] | ReadonlySet<string> | null
  }): Promise<ToolResult> {
    const definition = this.tools.get(args.toolId)
    if (!definition) {
      throw new Error(`[tools] Tool "${args.toolId}" is not registered`)
    }
    if (!definition.execute) {
      throw new Error(`[tools] Tool "${args.toolId}" does not provide an executor`)
    }
    const input = this.validateCall({
      toolId: args.toolId,
      input: args.input,
      allowedToolIds: args.allowedToolIds,
    })
    const execute = definition.execute as (input: unknown, context: unknown) => unknown | Promise<unknown>
    const output = await execute(input, args.context)
    return { toolId: args.toolId, output }
  }
}

export function createToolRegistry(tools: readonly ToolDefinition[] = []): ToolRegistry {
  return new ToolRegistry(tools)
}
