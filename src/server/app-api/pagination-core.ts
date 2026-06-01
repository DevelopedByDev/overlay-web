import { PaginationQuery } from '@/shared/schemas/common'
import { queryParamsToObject } from '@/shared/schemas/api-boundary'
import type { PaginatedEnvelope, PaginationOrder, PaginationSort } from '@/shared/api/pagination'

type ListItem = Record<string, unknown>

type CursorPayload = {
  id?: string
  order: PaginationOrder
  sort: PaginationSort
}

function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
}

function decodeCursor(value: string | undefined): CursorPayload | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Partial<CursorPayload>
    if (
      (parsed.sort === 'createdAt' || parsed.sort === 'updatedAt' || parsed.sort === 'name') &&
      (parsed.order === 'asc' || parsed.order === 'desc')
    ) {
      return {
        id: typeof parsed.id === 'string' ? parsed.id : undefined,
        sort: parsed.sort,
        order: parsed.order,
      }
    }
  } catch (_error) {
    // Invalid cursors fall back to the first page.
  }
  return null
}

function itemId(item: ListItem): string | undefined {
  const value = item._id ?? item.id ?? item.fileId ?? item.memoryId
  return typeof value === 'string' ? value : undefined
}

function numericSortValue(item: ListItem, key: 'createdAt' | 'updatedAt'): number {
  const value = item[key]
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const fallback = key === 'updatedAt' ? item.createdAt ?? item.completedAt : item.completedAt ?? item.updatedAt
  return typeof fallback === 'number' && Number.isFinite(fallback) ? fallback : 0
}

function nameSortValue(item: ListItem): string {
  const value = item.name ?? item.title ?? item.fileName ?? item.prompt ?? ''
  return typeof value === 'string' ? value.toLocaleLowerCase() : ''
}

function compareItems(sort: PaginationSort, order: PaginationOrder) {
  const direction = order === 'asc' ? 1 : -1
  return (a: ListItem, b: ListItem): number => {
    let result = 0
    if (sort === 'name') {
      result = nameSortValue(a).localeCompare(nameSortValue(b))
    } else {
      result = numericSortValue(a, sort) - numericSortValue(b, sort)
    }
    if (result === 0) result = (itemId(a) ?? '').localeCompare(itemId(b) ?? '')
    return result * direction
  }
}

export function paginateArray<T extends ListItem>(
  items: T[],
  query: URLSearchParams,
): PaginatedEnvelope<T> {
  const parsed = PaginationQuery.parse(queryParamsToObject(query))
  const sorted = [...items].sort(compareItems(parsed.sort, parsed.order) as (a: T, b: T) => number)
  const cursor = decodeCursor(parsed.cursor)
  const startIndex =
    cursor?.id && cursor.sort === parsed.sort && cursor.order === parsed.order
      ? sorted.findIndex((item) => itemId(item) === cursor.id) + 1
      : 0
  const safeStartIndex = Math.max(0, startIndex)
  const pageItems = sorted.slice(safeStartIndex, safeStartIndex + parsed.limit + 1)
  const data = pageItems.slice(0, parsed.limit)
  const hasMore = pageItems.length > parsed.limit
  const last = data[data.length - 1]
  const nextCursor = hasMore && last
    ? encodeCursor({ id: itemId(last), sort: parsed.sort, order: parsed.order })
    : undefined

  return {
    data,
    ...(nextCursor ? { nextCursor } : {}),
    hasMore,
    total: sorted.length,
  }
}
