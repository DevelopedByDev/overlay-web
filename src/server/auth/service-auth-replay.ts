import 'server-only'

import { convex } from '@/server/database/convex'
import { getInternalApiSecret } from '@/server/tools/internal-api-secret'
import type { ServiceAuthPayload } from '@/server/auth/service-auth'

export async function consumeServiceAuthReplayNonce(payload: ServiceAuthPayload): Promise<boolean> {
  const result = await convex.mutation<{ consumed: boolean; reason?: string }>(
    'serviceAuth:consumeReplayNonceByServer',
    {
      serverSecret: getInternalApiSecret(),
      jti: payload.jti,
      subject: payload.sub,
      method: payload.method,
      path: payload.path,
      expiresAt: payload.exp,
    },
    {
      throwOnError: true,
      timeoutMs: 10_000,
    },
  )

  return result?.consumed === true
}
