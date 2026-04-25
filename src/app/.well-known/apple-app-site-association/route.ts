import { NextResponse } from 'next/server'

const TEAM_ID = '562STT95YC'
const BUNDLE_ID = 'com.layernorm.overlay-mobile'

export async function GET() {
  return NextResponse.json(
    {
      applinks: {
        apps: [],
        details: [
          {
            appIDs: [`${TEAM_ID}.${BUNDLE_ID}`],
            appID: `${TEAM_ID}.${BUNDLE_ID}`,
            paths: ['/auth/native/callback', '/auth/native/callback/*'],
            components: [
              {
                '/': '/auth/native/callback',
                '?': { code: '*', state: '*' },
                comment: 'Overlay mobile auth callback',
              },
            ],
          },
        ],
      },
    },
    {
      headers: {
        'Content-Type': 'application/pkcs7-mime',
        'Cache-Control': 'public, max-age=3600',
      },
    },
  )
}
