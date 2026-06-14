'use client'

import { useCallback, useEffect, useState } from 'react'
import type { GatewayCatalogModel } from '@/shared/ai/gateway/gateway-catalog'
import { registerGatewayCatalogModels } from '@/shared/ai/gateway/model-data'

let cachedModels: GatewayCatalogModel[] | null = null
let inFlight: Promise<GatewayCatalogModel[]> | null = null

async function loadCatalog(force = false): Promise<GatewayCatalogModel[]> {
  if (!force && cachedModels) return cachedModels
  if (!force && inFlight) return inFlight
  inFlight = fetch(`/api/v1/model-catalog${force ? '?refresh=1' : ''}`, { cache: 'no-store' })
    .then(async (response) => {
      if (!response.ok) throw new Error('Failed to load the AI Gateway model catalog')
      const payload = await response.json() as { models?: GatewayCatalogModel[] }
      const models = payload.models ?? []
      cachedModels = models
      registerGatewayCatalogModels(models)
      return models
    })
    .finally(() => {
      inFlight = null
    })
  return inFlight
}

export function useGatewayModelCatalog() {
  const [models, setModels] = useState<GatewayCatalogModel[]>(() => cachedModels ?? [])
  const [isLoading, setIsLoading] = useState(!cachedModels)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const next = await loadCatalog(true)
      setModels(next)
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Failed to load models')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (cachedModels) {
      registerGatewayCatalogModels(cachedModels)
      return
    }
    let active = true
    void loadCatalog()
      .then((next) => {
        if (active) setModels(next)
      })
      .catch((value) => {
        if (active) setError(value instanceof Error ? value.message : 'Failed to load models')
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  return { models, isLoading, error, refresh }
}
