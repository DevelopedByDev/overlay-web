import { NextResponse } from 'next/server'

const TEAM_ID = '562STT95YC'
const BUNDLE_ID = 'com.layernorm.overlay-mobile'

export async function GET() {
  return NextResponse.json(
    {
      applinks: {
        details: [
          {
            appIDs: [`${TEAM_ID}.${BUNDLE_ID}`],
            components: [
              {
                '/': '/auth/native/callback',
                comment: 'Overlay mobile auth callback',
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
