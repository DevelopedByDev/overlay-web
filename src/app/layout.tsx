import type { Metadata } from "next";
import { Instrument_Serif } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { AuthProvider } from "@/contexts/AuthContext";
import ObservabilityClient from "@/components/ObservabilityClient";
import "katex/dist/katex.min.css";
import "./globals.css";

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "overlay",
  description: "An OS-level, hotkey-activated overlay that moves execution into overlays where intent first appears. Voice-to-text, notes, AI chat, and browsing — all without leaving your flow.",
  keywords: ["productivity", "voice-to-text", "AI assistant", "overlay", "desktop app", "macOS"],
  icons: {
    icon: [
      { url: "/icon.png", sizes: "64x64", type: "image/png" },
    ],
  },
  openGraph: {
    title: "overlay — personal computing, reimagined",
    description: "the computer, at the speed of human thought.",
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
    title: "overlay — personal computing, reimagined",
    description: "the computer, at the speed of human thought.",
    images: ["https://getoverlay.io/assets/overlay-logo.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${instrumentSerif.variable} antialiased`}>
        <AuthProvider>
          <ObservabilityClient />
          {children}
        </AuthProvider>
        <SpeedInsights />
      </body>
    </html>
  );
}
