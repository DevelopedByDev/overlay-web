import { NextResponse } from 'next/server'

const TEAM_ID = '562STT95YC'
const BUNDLE_ID = 'com.layernorm.overlay-mobile'
const APP_ID = `${TEAM_ID}.${BUNDLE_ID}`

export async function GET() {
  return NextResponse.json(
    {
      applinks: {
        apps: [],
        details: [
          {
            appID: APP_ID,
            appIDs: [APP_ID],
            paths: ['/auth/native/callback', '/auth/native/callback/*'],
            components: [
              {
                '/': '/auth/native/callback',
                comment: 'Overlay mobile auth callback',
              },
              {
                '/': '/auth/native/callback/*',
                comment: 'Overlay mobile auth callback subpaths',
              },
            ],
          },
        ],
      },
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600',
      },
    },
  )
}
