import { randomUUID } from 'node:crypto'
export function nowMs(): number {
  return Date.now()
}

export function newId(prefix: string): string {
  return `${prefix}_${randomUUID()}`
}

export function withDefaultOrg<T extends { orgId?: string }>(
  data: T,
  fallbackOrgId = 'default',
): T & { orgId: string } {
  return { ...data, orgId: data.orgId || fallbackOrgId }
}

export function notImplemented(method: string): never {
  throw new Error(`${method} is not implemented by this provider yet.`)
}
