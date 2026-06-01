import 'server-only'

import { convex } from '@/server/database/convex'
import { getInternalApiSecret } from '@/server/shared/internal-api-secret'
import type { WebhookEvent } from '@/shared/schemas/webhooks'
import { WebhookEventSchema } from '@/shared/schemas/webhooks'

export type WebhookDispatchResult = {
  enqueued: number
}

export class WebhookDispatcher {
  async dispatch(userId: string, event: WebhookEvent): Promise<WebhookDispatchResult> {
    const parsed = WebhookEventSchema.parse({
      ...event,
      userId: event.userId || userId,
    })

    const result = await convex.mutation<{ enqueued: number }>(
      'webhooks/deliveries:enqueueByServer',
      {
        serverSecret: getInternalApiSecret(),
        userId: parsed.userId,
        eventId: parsed.id,
        eventType: parsed.type,
        payloadJson: JSON.stringify(parsed),
      },
      {
        throwOnError: true,
        timeoutMs: 10_000,
        suppressNetworkConsoleError: true,
      },
    )

    return { enqueued: result?.enqueued ?? 0 }
  }
}

export const webhookDispatcher = new WebhookDispatcher()

export async function dispatchWebhookEvent(
  userId: string,
  event: WebhookEvent,
): Promise<WebhookDispatchResult> {
  return webhookDispatcher.dispatch(userId, event)
}
