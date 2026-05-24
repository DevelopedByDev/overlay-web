import 'server-only'

import overlayAppConfig from '@/overlay.config'
import { OpenRouterGateway } from '@/server/ai/providers'
import { WorkOSAuthProvider } from '@/server/auth/providers'
import { StripeBillingProvider } from '@/server/billing/providers'
import { ConvexNoteRepository, type NoteRepository } from '@/server/notes'
import { ConvexRateLimiter, InMemoryEventBus } from '@/server/shared/providers'
import { ConvexVectorStore, R2ObjectStore } from '@/server/storage/providers'
import type {
  OverlayAppConfig,
  OverlayServerContext as OverlayProviderContext,
} from '@overlay/app-core'

export interface OverlayServerContext extends OverlayProviderContext {
  noteRepository: NoteRepository
}

export function createOverlayServerContext(
  config: OverlayAppConfig = overlayAppConfig,
): OverlayServerContext {
  return {
    auth: config.authProvider ?? new WorkOSAuthProvider(),
    billing: config.billingProvider ?? new StripeBillingProvider(),
    objectStore: config.objectStore ?? new R2ObjectStore(),
    vectorStore: config.vectorStore ?? new ConvexVectorStore(),
    llmGateway: config.llmGateway ?? new OpenRouterGateway(),
    rateLimiter: config.rateLimiter ?? new ConvexRateLimiter(),
    eventBus: config.eventBus ?? new InMemoryEventBus(),
    noteRepository: new ConvexNoteRepository(),
  }
}

let defaultServerContext: OverlayServerContext | null = null

export function getOverlayServerContext(): OverlayServerContext {
  defaultServerContext ??= createOverlayServerContext(overlayAppConfig)
  return defaultServerContext
}
