'use client'

import { useCallback, useEffect, useState } from 'react'
import { registerByokModels } from '@/shared/ai/gateway/model-data'
import {
  isByokConnectionRow,
  type ByokConnectionRow,
} from '@/shared/ai/gateway/byok-model-conversion'

let cachedConnections: ByokConnectionRow[] | null = null
let inFlight: Promise<ByokConnectionRow[]> | null = null

function payloadErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  const error = (payload as { error?: unknown }).error
  return typeof error === 'string' && error.trim() ? error : null
}

export function normalizeByokConnectionsPayload(payload: unknown): ByokConnectionRow[] {
  const candidate = Array.isArray(payload)
    ? payload
    : payload && typeof payload === 'object'
      ? (payload as { data?: unknown; connections?: unknown; items?: unknown }).data ??
        (payload as { data?: unknown; connections?: unknown; items?: unknown }).connections ??
        (payload as { data?: unknown; connections?: unknown; items?: unknown }).items
      : undefined

  if (!Array.isArray(candidate)) {
    throw new Error(payloadErrorMessage(payload) ?? 'Invalid BYOK provider connections response')
  }

  return candidate.filter(isByokConnectionRow)
}

async function loadConnections(force = false): Promise<ByokConnectionRow[]> {
  if (!force && cachedConnections) return cachedConnections
  if (!force && inFlight) return inFlight
  inFlight = fetch('/api/v1/providers/connections', { cache: 'no-store' })
    .then(async (response) => {
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payloadErrorMessage(payload) ?? 'Failed to load BYOK provider connections')
      }
      const connections = normalizeByokConnectionsPayload(payload)
      cachedConnections = connections
      registerByokModels(connections)
      return connections
    })
    .finally(() => {
      inFlight = null
    })
  return inFlight
}

export function useByokModels() {
  const [connections, setConnections] = useState<ByokConnectionRow[]>(() => cachedConnections ?? [])
  const [isLoading, setIsLoading] = useState(!cachedConnections)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const next = await loadConnections(true)
      setConnections(next)
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Failed to load connections')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (cachedConnections) {
      registerByokModels(cachedConnections)
      return
    }
    let active = true
    void loadConnections()
      .then((next) => {
        if (active) setConnections(next)
      })
      .catch((value) => {
        if (active) setError(value instanceof Error ? value.message : 'Failed to load connections')
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  return { connections, isLoading, error, refresh }
}
