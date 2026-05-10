import type { Metadata } from "next";
import { Suspense } from "react";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { AuthProvider } from "@/contexts/AuthContext";
import ObservabilityClient from "@/components/ObservabilityClient";
import { AppSettingsProvider } from "@/components/app/AppSettingsProvider";
import { ConvexProviderWithWorkOS } from "@/components/ConvexProviderWithWorkOS";
import { ThemeProvider } from "@overlay/ui";
import "katex/dist/katex.min.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "overlay",
  description:
    "Overlay is the unified AI interaction layer: chat, voice notes, browser tasks, agents, automations, context, and content generation in one open-source workspace.",
  keywords: [
    "AI workspace",
    "AI interaction layer",
    "open source AI",
    "AI agents",
    "browser agent",
    "voice notes",
    "Overlay",
    "ChatGPT alternative",
    "Claude alternative",
    "Perplexity alternative",
  ],
  icons: {
    icon: [
      { url: "/icon.png", sizes: "64x64", type: "image/png" },
    ],
  },
  openGraph: {
    title: "overlay — the unified AI interaction layer",
    description:
      "Open-source AI workspace for chat, voice notes, browser tasks, agents, automations, context, and content generation.",
    type: "website",
    url: "https://getoverlay.io",
    images: [
      {
        url: "https://getoverlay.io/assets/overlay-logo.png",
        width: 512,
        height: 512,
        alt: "overlay logo",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "overlay — the unified AI interaction layer",
    description:
      "Open-source AI workspace for chat, voice notes, browser tasks, agents, automations, context, and content generation.",
    images: ["https://getoverlay.io/assets/overlay-logo.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                try {
                  var raw = window.localStorage.getItem('overlay.app.settings');
                  if (!raw) return;
                  var theme = JSON.parse(raw).theme;
                  if (theme === 'light' || theme === 'dark') {
                    document.documentElement.dataset.theme = theme;
                    document.documentElement.style.colorScheme = theme;
                  }
                } catch (_) {}
              })();
            `,
          }}
        />
      </head>
      <body className="antialiased bg-background text-foreground">
        <AppSettingsProvider>
          <AuthProvider>
            <ConvexProviderWithWorkOS>
              <ThemeProvider>
                <Suspense fallback={null}>
                  <ObservabilityClient />
                </Suspense>
                {children}
              </ThemeProvider>
            </ConvexProviderWithWorkOS>
          </AuthProvider>
        </AppSettingsProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
