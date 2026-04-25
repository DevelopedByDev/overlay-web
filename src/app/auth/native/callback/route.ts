import { NextResponse } from 'next/server'

export async function GET() {
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
      p { margin: 0 0 14px; color: rgba(247, 247, 243, 0.72); line-height: 1.5; }
      small { display: block; color: rgba(247, 247, 243, 0.48); line-height: 1.45; }
    </style>
  </head>
  <body>
    <main>
      <h1>Overlay could not open</h1>
      <p>This sign-in link must open through the installed Overlay app. Close this browser, rebuild the app, and try signing in again.</p>
      <small>If you are testing a development build, confirm Associated Domains are enabled for <strong>applinks:www.getoverlay.io</strong>.</small>
    </main>
  </body>
</html>`, {
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      'Content-Type': 'text/html; charset=utf-8',
    },
  })
}
