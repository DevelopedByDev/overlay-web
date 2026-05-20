import 'server-only'

import type { EventBus } from '@overlay/app-core'

export class InMemoryEventBus implements EventBus {
  private readonly handlers = new Map<string, Set<(payload: unknown) => void>>()

  async publish(topic: string, payload: unknown): Promise<void> {
    for (const handler of this.handlers.get(topic) ?? []) {
      handler(payload)
    }
  }

  subscribe(topic: string, handler: (payload: unknown) => void): () => void {
    const handlers = this.handlers.get(topic) ?? new Set<(payload: unknown) => void>()
    handlers.add(handler)
    this.handlers.set(topic, handlers)

    return () => {
      handlers.delete(handler)
      if (handlers.size === 0) {
        this.handlers.delete(topic)
      }
    }
  }
}
