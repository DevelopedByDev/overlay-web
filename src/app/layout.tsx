import type { Metadata } from "next";
import { Instrument_Serif } from "next/font/google";
import "./globals.css";

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "dawn",
  description: "An OS-level, hotkey-activated overlay that moves execution into overlays where intent first appears. Voice-to-text, notes, AI chat, and browsing — all without leaving your flow.",
  keywords: ["productivity", "voice-to-text", "AI assistant", "overlay", "desktop app", "macOS"],
  icons: {
    icon: [
      { url: "/icon.png", sizes: "64x64", type: "image/png" },
    ],
  },
  openGraph: {
    title: "dawn — personal computing, reimagined",
    description: "the computer, at the speed of human thought.",
    type: "website",
    url: "https://getdawn.io",
    images: [
      {
        url: "https://getdawn.io/assets/dawn-logo.png",
        width: 512,
        height: 512,
        alt: "dawn logo",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "dawn — personal computing, reimagined",
    description: "the computer, at the speed of human thought.",
    images: ["https://getdawn.io/assets/dawn-logo.png"],
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
        {children}
      </body>
    </html>
  );
}
