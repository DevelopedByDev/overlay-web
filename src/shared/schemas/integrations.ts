import { z } from 'zod'
import { AuthFields, IntegerQueryValue, UnknownResponse } from './common'

export const IntegrationListQuery = z.object({
  action: z.string().optional(),
  q: z.string().optional(),
  cursor: z.string().optional(),
  limit: IntegerQueryValue,
})

export const IntegrationConnectRequest = z.object({
  ...AuthFields,
  toolkit: z.string().optional(),
  slug: z.string().optional(),
  redirectUrl: z.string().url().optional(),
}).passthrough()

export const IntegrationResponse = UnknownResponse
