import 'server-only'

import { createHash } from 'node:crypto'

export function hashTextContent(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}
