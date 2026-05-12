import { z } from 'zod'

declare module 'zod' {
  // Zod v3 declares this first generic as `any`; declaration merging requires an exact match.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface ZodType<Output = any, Def extends z.ZodTypeDef = z.ZodTypeDef, Input = Output> {
    openapi(name: string): ZodType<Output, Def, Input>
  }
}

if (typeof z.ZodType.prototype.openapi !== 'function') {
  z.ZodType.prototype.openapi = function openapi() {
    return this
  }
}

export { z }

export const UserId = z.string().min(1)
export const ConversationId = z.string().min(1)
export const FileId = z.string().min(1)
export const ProjectId = z.string().min(1)
export const OutputId = z.string().min(1)
export const AccessTokenPayload = z.object({
  accessToken: z.string().optional(),
  userId: z.string().optional(),
})
export const ErrorResponse = z.object({
  error: z.string(),
  code: z.string().optional(),
}).openapi('ErrorResponse')
export const SuccessResponse = z.object({
  success: z.boolean(),
}).passthrough().openapi('SuccessResponse')

export function parseSearchParams<T>(schema: z.ZodType<T>, request: { url: string }): T {
  const params = Object.fromEntries(new URL(request.url).searchParams.entries())
  return schema.parse(params)
}

export async function parseJsonBody<T>(schema: z.ZodType<T>, request: Request): Promise<T> {
  const contentType = request.headers.get('content-type') || ''
  const body = contentType.includes('application/json') ? await request.json() : {}
  return schema.parse(body)
}
