import { z } from 'zod'

export const AuthFields = {
  accessToken: z.string().min(1).optional(),
  userId: z.string().min(1).optional(),
} as const

export const EmptyQuery = z.object({}).passthrough()
export const EmptyRequest = z.object({ ...AuthFields }).passthrough()
export const UnknownResponse = z.unknown()

export const BooleanQueryValue = z.enum(['true', 'false', '1', '0']).optional()
export const IntegerQueryValue = z
  .string()
  .regex(/^\d+$/)
  .optional()

export const IdQuery = z.string().min(1).optional()

export const JsonRecord = z.record(z.string(), z.unknown())

export const FormDataBoundary = z.instanceof(FormData)
