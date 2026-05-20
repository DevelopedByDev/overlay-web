import 'server-only'

import type { EventBus } from '@overlay/app-core'

export class NoOpEventBus implements EventBus {
  async publish(topic: string, payload: unknown): Promise<void> {
    void topic
    void payload
  }

  subscribe(topic: string, handler: (payload: unknown) => void): () => void {
    void topic
    void handler
    return () => {}
  }
}
