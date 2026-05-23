import type { AgentContextBuilder, AgentRuntimeContext, AgentTurnInput } from './types'
import type { LLMGateway } from '@overlay/llm-gateway'
import type { ToolDefinition } from '@overlay/tools-core'

export type ContextBuilder = AgentContextBuilder

export interface ContextSourceResult {
  systemContext?: string
  resources?: Record<string, unknown>
  metadata?: Record<string, unknown>
}

export type ContextSourceLoader = (args: {
  input: AgentTurnInput
  tools: readonly ToolDefinition[]
  llmGateway?: LLMGateway
}) => Promise<ContextSourceResult>

function mergeContexts(contexts: readonly AgentRuntimeContext[]): AgentRuntimeContext {
  return contexts.reduce<AgentRuntimeContext>((merged, context) => ({
    systemContext: [merged.systemContext, context.systemContext].filter(Boolean).join('\n\n') || undefined,
    resources: { ...merged.resources, ...context.resources },
    metadata: { ...merged.metadata, ...context.metadata },
  }), {})
}

export class ContextSourceBuilder implements AgentContextBuilder {
  constructor(
    private readonly sourceName: string,
    private readonly loader: ContextSourceLoader,
  ) {}

  async build(args: {
    input: AgentTurnInput
    tools: readonly ToolDefinition[]
    llmGateway?: LLMGateway
  }): Promise<AgentRuntimeContext> {
    const result = await this.loader(args)
    return {
      systemContext: result.systemContext,
      resources: result.resources,
      metadata: {
        ...result.metadata,
        sourceName: this.sourceName,
      },
    }
  }
}

export class KnowledgeContextBuilder extends ContextSourceBuilder {
  constructor(loader: ContextSourceLoader) {
    super('knowledge', loader)
  }
}

export class MemoryContextBuilder extends ContextSourceBuilder {
  constructor(loader: ContextSourceLoader) {
    super('memory', loader)
  }
}

export class FileContextBuilder extends ContextSourceBuilder {
  constructor(loader: ContextSourceLoader) {
    super('files', loader)
  }
}

export class NoOpContextBuilder implements AgentContextBuilder {
  async build(): Promise<AgentRuntimeContext> {
    return {}
  }
}

export class StaticContextBuilder implements AgentContextBuilder {
  constructor(private readonly context: AgentRuntimeContext) {}

  async build(): Promise<AgentRuntimeContext> {
    return this.context
  }
}

export class CompositeContextBuilder implements AgentContextBuilder {
  constructor(private readonly builders: readonly AgentContextBuilder[]) {}

  async build(args: {
    input: AgentTurnInput
    tools: readonly ToolDefinition[]
    llmGateway?: LLMGateway
  }): Promise<AgentRuntimeContext> {
    const contexts = await Promise.all(this.builders.map((builder) => builder.build(args)))
    return mergeContexts(contexts)
  }
}
