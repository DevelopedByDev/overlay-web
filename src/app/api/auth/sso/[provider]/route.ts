import { NextRequest, NextResponse } from 'next/server'
import { getAuthorizationUrl, normalizeAuthRedirect, normalizeCodeChallenge } from '@/lib/workos-auth'

import { z } from '@/lib/api-schemas'

const AuthSsoProviderRequestSchema = z.object({ provider: z.enum(['google', 'apple', 'microsoft']).optional(), redirect: z.string().optional(), codeChallenge: z.string().optional(), force: z.enum(['true', 'false']).optional() }).openapi('AuthSsoProviderRequest')
const AuthSsoProviderResponseSchema = z.unknown().openapi('AuthSsoProviderResponse')
void AuthSsoProviderRequestSchema
void AuthSsoProviderResponseSchema

type SSOProvider = 'google' | 'apple' | 'microsoft'

const providerMap: Record<SSOProvider, 'GoogleOAuth' | 'AppleOAuth' | 'MicrosoftOAuth'> = {
  google: 'GoogleOAuth',
  apple: 'AppleOAuth',
  microsoft: 'MicrosoftOAuth',
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params
  const { searchParams } = new URL(request.url)
  const redirectUri = searchParams.get('redirect') || undefined
  const normalizedRedirectUri = normalizeAuthRedirect(redirectUri)
  const codeChallenge = normalizeCodeChallenge(searchParams.get('codeChallenge'))
  const forceSignIn = searchParams.get('force') === 'true'
  
  // Also force sign-in when redirecting to desktop app (overlay:// protocol)
  const isDesktopAuth = redirectUri?.startsWith('overlay://')

  if (!providerMap[provider as SSOProvider]) {
    return NextResponse.json(
      { error: 'Invalid provider. Use google, apple, or microsoft.' },
      { status: 400 }
    )
  }

  if (redirectUri && normalizedRedirectUri === null) {
    return NextResponse.json(
      { error: 'Invalid redirect URI' },
      { status: 400 }
    )
  }
  if (searchParams.has('codeChallenge') && !codeChallenge) {
    return NextResponse.json(
      { error: 'Invalid codeChallenge' },
      { status: 400 }
    )
  }

  try {
    console.log('[Auth] SSO request:', { provider, redirectUri, forceSignIn, isDesktopAuth })
    
    const authUrl = await getAuthorizationUrl(
      providerMap[provider as SSOProvider],
      {
        redirectUri: normalizedRedirectUri ?? undefined,
        forceSignIn: forceSignIn || isDesktopAuth,
        codeChallenge,
      },
    )

    console.log('[Auth] Generated auth URL, redirecting...')
    return NextResponse.redirect(authUrl)
  } catch (error) {
    console.error('[Auth] SSO error details:', {
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      provider,
      redirectUri,
      forceSignIn
    })
    return NextResponse.json(
      { error: 'Failed to initiate SSO', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
