'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ACT_MODEL_KEY,
  CHAT_MODEL_KEY,
} from '@/shared/chat/chat-model-prefs'
import {
  DEFAULT_MODEL_ID,
  FREE_TIER_DEFAULT_MODEL_ID,
  isFreeTierChatModelId,
  isLegacyFreeTierDefaultModelId,
} from '@/shared/ai/gateway/model-types'
import {
  getModelsByIntelligence,
  modelSupportsZeroDataRetention,
} from '@/shared/ai/gateway/model-data'
import { overlayAppClient } from '@/shared/app/overlay-app-client'
import type { Entitlements } from '../chat-interface/types'

type ChatRouter = {
  replace: (href: string) => void
}

type ChatSearchParams = {
  get: (name: string) => string | null
  toString: () => string
} | null

export function useChatBillingControls({
  activeChatId,
  billingEnabled,
  chatPrefsHydrated,
  onlyAllowZdrModels,
  pathname,
  router,
  searchParams,
  selectedActModel,
  selectedModels,
  setAskModelSelectionMode,
  setComposerNotice,
  setSelectedActModel,
  setSelectedModels,
}: {
  activeChatId: string | null
  billingEnabled: boolean
  chatPrefsHydrated: boolean
  onlyAllowZdrModels: boolean
  pathname: string
  router: ChatRouter
  searchParams: ChatSearchParams
  selectedActModel: string
  selectedModels: string[]
  setAskModelSelectionMode: (mode: 'single' | 'multiple') => void
  setComposerNotice: (value: string | null | ((current: string | null) => string | null)) => void
  setSelectedActModel: (modelId: string) => void
  setSelectedModels: (modelIds: string[]) => void
}) {
  const [topUpAmountDraftCents, setTopUpAmountDraftCents] = useState(800)
  const [autoTopUpEnabledDraft, setAutoTopUpEnabledDraft] = useState(false)
  const [billingActionLoading, setBillingActionLoading] = useState<'checkout' | 'save' | null>(null)
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null)

  const isPaidSubscription =
    !billingEnabled ||
    (entitlements?.planKind ?? (entitlements?.tier === 'free' ? 'free' : 'paid')) === 'paid'
  const budgetTotalCents = entitlements
    ? (entitlements.budgetTotalCents ?? Math.max(0, Math.round((entitlements.creditsTotal ?? 0) * 100)))
    : 0
  const budgetUsedCents = entitlements
    ? (entitlements.budgetUsedCents ?? Math.max(0, Math.round(entitlements.creditsUsed ?? 0)))
    : 0
  const budgetRemainingCents = entitlements
    ? (entitlements.budgetRemainingCents ?? Math.max(0, budgetTotalCents - budgetUsedCents))
    : 0
  const isBudgetExhaustedPaid = billingEnabled && isPaidSubscription && budgetRemainingCents <= 0
  const isFreeTier = billingEnabled && (!isPaidSubscription || isBudgetExhaustedPaid)
  const effectiveOnlyAllowZdrModels = isPaidSubscription && !isBudgetExhaustedPaid && onlyAllowZdrModels
  const selectableTextModels = useMemo(() => {
    const models = getModelsByIntelligence(isFreeTier)
      .filter((model) => model.id !== 'nvidia/nemotron-nano-9b-v2')
    return effectiveOnlyAllowZdrModels
      ? models.filter((model) => model.supportsZeroDataRetention)
      : models
  }, [effectiveOnlyAllowZdrModels, isFreeTier])
  const premiumModelBlocked =
    isFreeTier && !isFreeTierChatModelId(selectedActModel)
  const isSendBlocked = premiumModelBlocked

  useEffect(() => {
    if (!chatPrefsHydrated || !isFreeTier || activeChatId) return
    if (isFreeTierChatModelId(selectedActModel) && !isLegacyFreeTierDefaultModelId(selectedActModel)) return

    setSelectedModels([FREE_TIER_DEFAULT_MODEL_ID])
    setAskModelSelectionMode('single')
    setSelectedActModel(FREE_TIER_DEFAULT_MODEL_ID)
    localStorage.setItem(CHAT_MODEL_KEY, JSON.stringify([FREE_TIER_DEFAULT_MODEL_ID]))
    localStorage.setItem(ACT_MODEL_KEY, FREE_TIER_DEFAULT_MODEL_ID)
  }, [
    activeChatId,
    chatPrefsHydrated,
    isFreeTier,
    selectedActModel,
    setAskModelSelectionMode,
    setSelectedActModel,
    setSelectedModels,
  ])

  useEffect(() => {
    if (!chatPrefsHydrated || !effectiveOnlyAllowZdrModels) return
    const fallback = selectableTextModels[0]?.id ?? DEFAULT_MODEL_ID
    const nextSelected = selectedModels.filter((id) => modelSupportsZeroDataRetention(id)).slice(0, 4)
    const resolvedSelected = nextSelected.length > 0 ? nextSelected : [fallback]
    const nextActModel = modelSupportsZeroDataRetention(selectedActModel) ? selectedActModel : resolvedSelected[0]!
    const changed =
      resolvedSelected.length !== selectedModels.length ||
      resolvedSelected.some((id, index) => id !== selectedModels[index]) ||
      nextActModel !== selectedActModel
    if (!changed) return
    setSelectedModels(resolvedSelected)
    setSelectedActModel(nextActModel)
    if (resolvedSelected.length === 1) setAskModelSelectionMode('single')
    if (!activeChatId) {
      try { localStorage.setItem(CHAT_MODEL_KEY, JSON.stringify(resolvedSelected)) } catch { /* ignore */ }
      try { localStorage.setItem(ACT_MODEL_KEY, nextActModel) } catch { /* ignore */ }
    }
  }, [
    activeChatId,
    chatPrefsHydrated,
    effectiveOnlyAllowZdrModels,
    selectableTextModels,
    selectedActModel,
    selectedModels,
    setAskModelSelectionMode,
    setSelectedActModel,
    setSelectedModels,
  ])

  const loadSubscription = useCallback(async () => {
    if (!billingEnabled) {
      setEntitlements(null)
      return
    }
    try {
      const res = await overlayAppClient.subscription.getResponse()
      if (res.ok) {
        const data = await res.json()
        setEntitlements(data)
        setTopUpAmountDraftCents(data.topUpAmountCents ?? data.autoTopUpAmountCents ?? 800)
        setAutoTopUpEnabledDraft(Boolean(data.autoTopUpEnabled))
      }
    } catch { /* ignore */ }
  }, [billingEnabled])

  const buildTopUpReturnPath = useCallback(() => {
    const nextParams = new URLSearchParams(searchParams?.toString() ?? '')
    nextParams.delete('topup_success')
    nextParams.delete('topup_session_id')
    nextParams.delete('topup_canceled')
    const query = nextParams.toString()
    return `${pathname}${query ? `?${query}` : ''}`
  }, [pathname, searchParams])

  const handleStartTopUp = useCallback(async () => {
    setBillingActionLoading('checkout')
    try {
      const response = await fetch('/api/topups/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountCents: topUpAmountDraftCents,
          autoTopUpEnabled: autoTopUpEnabledDraft,
          returnPath: buildTopUpReturnPath(),
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || !data.url) {
        setComposerNotice(data.error || 'Failed to start top-up checkout.')
        return
      }
      window.location.href = data.url
    } catch {
      setComposerNotice('Failed to start top-up checkout.')
    } finally {
      setBillingActionLoading(null)
    }
  }, [autoTopUpEnabledDraft, buildTopUpReturnPath, setComposerNotice, topUpAmountDraftCents])

  const handleSaveTopUpPreference = useCallback(async () => {
    setBillingActionLoading('save')
    try {
      const response = await overlayAppClient.subscription.updateSettingsResponse({
        autoTopUpEnabled: autoTopUpEnabledDraft,
        topUpAmountCents: topUpAmountDraftCents,
        grantOffSessionConsent: autoTopUpEnabledDraft,
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        setComposerNotice(data.error || 'Failed to save top-up preference.')
        return
      }
      await loadSubscription()
      setComposerNotice('Top-up preference updated.')
      window.setTimeout(() => setComposerNotice((current) => current === 'Top-up preference updated.' ? null : current), 5000)
    } catch {
      setComposerNotice('Failed to save top-up preference.')
    } finally {
      setBillingActionLoading(null)
    }
  }, [autoTopUpEnabledDraft, loadSubscription, setComposerNotice, topUpAmountDraftCents])

  useEffect(() => {
    if (!billingEnabled) return
    const topUpSuccess = searchParams?.get('topup_success') === 'true'
    const topUpSessionId = searchParams?.get('topup_session_id')
    const topUpCanceled = searchParams?.get('topup_canceled') === 'true'

    if (!topUpSuccess && !topUpCanceled) return

    const nextParams = new URLSearchParams(searchParams?.toString() ?? '')
    nextParams.delete('topup_success')
    nextParams.delete('topup_session_id')
    nextParams.delete('topup_canceled')
    const nextUrl = `${pathname}${nextParams.toString() ? `?${nextParams.toString()}` : ''}`

    if (topUpCanceled) {
      setComposerNotice('Top-up checkout canceled.')
      router.replace(nextUrl)
      return
    }

    if (!topUpSessionId) return

    let cancelled = false
    void fetch('/api/topups/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: topUpSessionId }),
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}))
        if (cancelled) return
        if (response.ok) {
          setComposerNotice(`Top-up applied: $${(Number(data.amountCents ?? 0) / 100).toFixed(2)}.`)
          await loadSubscription()
        } else {
          setComposerNotice(data.error || 'We could not verify your top-up.')
        }
      })
      .catch(() => {
        if (!cancelled) setComposerNotice('We could not verify your top-up.')
      })
      .finally(() => {
        if (!cancelled) router.replace(nextUrl)
      })

    return () => {
      cancelled = true
    }
  }, [billingEnabled, loadSubscription, pathname, router, searchParams, setComposerNotice])

  return {
    autoTopUpEnabledDraft,
    billingActionLoading,
    budgetRemainingCents,
    budgetTotalCents,
    budgetUsedCents,
    effectiveOnlyAllowZdrModels,
    entitlements,
    handleSaveTopUpPreference,
    handleStartTopUp,
    isBudgetExhaustedPaid,
    isFreeTier,
    isPaidSubscription,
    isSendBlocked,
    loadSubscription,
    premiumModelBlocked,
    selectableTextModels,
    setAutoTopUpEnabledDraft,
    setTopUpAmountDraftCents,
    topUpAmountDraftCents,
  }
}
