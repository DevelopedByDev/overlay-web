import { NextRequest, NextResponse } from 'next/server'

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export async function GET(request: NextRequest) {
  const callbackUrl = escapeHtml(request.url)

  return new NextResponse(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex,nofollow" />
    <title>Open Overlay</title>
    <style>
      :root { color-scheme: light dark; }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: #090909;
        color: #f7f7f3;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      main {
        width: min(420px, calc(100vw - 48px));
        padding: 28px;
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 28px;
        background: rgba(255, 255, 255, 0.06);
        text-align: center;
      }
      h1 { margin: 0 0 10px; font-size: 28px; line-height: 1.1; }
      p { margin: 0 0 22px; color: rgba(247, 247, 243, 0.72); line-height: 1.5; }
      a {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 48px;
        width: 100%;
        border-radius: 999px;
        background: #f7f7f3;
        color: #090909;
        font-weight: 700;
        text-decoration: none;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>Open Overlay</h1>
      <p>If Overlay did not open automatically, tap below to finish signing in.</p>
      <a href="${callbackUrl}">Continue in Overlay</a>
    </main>
  </body>
</html>`, {
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      'Content-Type': 'text/html; charset=utf-8',
    },
  })
}
