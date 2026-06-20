import { NextRequest, NextResponse } from 'next/server'
import type { AppApiRouteContext } from '@/server/app-api/bff-context'
import { validatePublicNetworkUrl } from '@/server/security/ssrf'
import { getByokPreset } from '@overlay/llm-gateway'

// POST /api/v1/providers/connections/test
// Tests a provider connection by fetching its model-discovery endpoint.
// The API key is passed in the request body (not yet stored in Vault) so the
// user can validate the connection before saving.
export async function POST(request: NextRequest, _context: AppApiRouteContext) {
  try {
    const body = await request.json()
    const { providerId, endpoint, apiKey } = body as Record<string, unknown>

    if (!providerId || typeof providerId !== 'string') {
      return NextResponse.json({ error: 'providerId is required' }, { status: 400 })
    }

    const preset = getByokPreset(providerId)
    if (!preset) {
      return NextResponse.json({ error: `Unknown provider: ${providerId}` }, { status: 400 })
    }

    const resolvedEndpoint =
      typeof endpoint === 'string' && endpoint.trim()
        ? endpoint.trim()
        : preset.defaultBaseURL

    if (!resolvedEndpoint) {
      return NextResponse.json(
        { error: 'endpoint is required for custom providers' },
        { status: 400 },
      )
    }

    // Validate the endpoint URL (SSRF protection)
    const urlResult = await validatePublicNetworkUrl(resolvedEndpoint, {
      allowLocalDev: false,
      requireHttps: true,
    })
    if (!urlResult.ok) {
      return NextResponse.json({ error: urlResult.error }, { status: 400 })
    }

    if (preset.requiresApiKey && (!apiKey || typeof apiKey !== 'string')) {
      return NextResponse.json(
        { error: `API key is required for ${preset.label}` },
        { status: 400 },
      )
    }

    // Fetch the model-discovery endpoint
    const discoveryUrl = `${resolvedEndpoint.replace(/\/$/, '')}${preset.discoveryPath}`
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...preset.headers,
    }
    if (typeof apiKey === 'string' && apiKey.length > 0) {
      headers['Authorization'] = `Bearer ${apiKey}`
    }

    const response = await fetch(discoveryUrl, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(15000),
    })

    if (!response.ok) {
      const text = await response.text().catch((_e) => '')
      return NextResponse.json(
        {
          ok: false,
          models: [],
          error: `HTTP ${response.status}: ${text.slice(0, 200) || response.statusText}`,
        },
        { status: 502 },
      )
    }

    const data = (await response.json()) as {
      data?: Array<{ id: string; name?: string }>
    }

    const models = (data.data ?? [])
      .filter((model) => typeof model.id === 'string' && model.id.length > 0)
      .map((model) => ({
        id: model.id,
        name: model.name ?? model.id,
      }))

    return NextResponse.json({ ok: true, models })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Connection test failed'
    return NextResponse.json({ ok: false, models: [], error: message }, { status: 502 })
  }
}
