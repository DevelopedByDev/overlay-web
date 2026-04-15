"use client";

import { motion } from "framer-motion";
import { Globe } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

const MODELS = [
  "Claude Opus 4.6",
  "GPT-5.2",
  "Gemini 3.1 Pro",
  "Grok 4.20",
  "Flux 2 Max",
  "Veo 3.1",
  "Kimi K2",
  "Qwen 3.6",
  "GLM-5.1",
];

const sectionInView = {
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.25 },
  transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
};

export function HeroSection({
  theme,
  webAppHref,
}: {
  theme: "light" | "dark";
  webAppHref: string;
}) {
  const isDark = theme === "dark";
  const muted = isDark ? "text-zinc-400" : "text-[#71717a]";
  const heading = isDark ? "text-zinc-100" : "text-[#0a0a0a]";
  const borderColor = isDark ? "border-zinc-800" : "border-zinc-200";

  return (
    <section className="relative z-10 flex min-h-screen flex-col items-center justify-center gap-10 px-6 pb-16 pt-32">
      {/* Text block */}
      <motion.div {...sectionInView} className="flex flex-col items-center gap-4 text-center">
        <div className="-mb-2">
          <Image
            src="/assets/overlay-logo.png"
            alt="Overlay"
            width={100}
            height={100}
            className="drop-shadow-2xl"
            priority
          />
        </div>
        <h1
          className={`font-serif text-5xl leading-tight tracking-tight md:text-7xl lg:text-8xl ${heading}`}
        >
          your all-in-one
          <br />
          ai platform
        </h1>
        <p className={`max-w-xl text-base font-light tracking-wide md:text-lg ${muted}`}>
          every model. every medium. your context. one surface.
        </p>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
          <Link
            href={webAppHref}
            className={`overlay-interactive inline-flex items-center justify-center gap-2 border px-7 py-3 text-sm font-medium ${
              isDark
                ? "border-zinc-100 bg-zinc-100 text-zinc-900"
                : "border-[#0a0a0a] bg-[#0a0a0a] text-white"
            }`}
          >
            <Globe className="h-4 w-4" />
            open app
          </Link>
        </div>
      </motion.div>

      {/* Product screenshot */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.15 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-4xl"
      >
        <div className={`relative flex h-[420px] items-center justify-center border border-dashed ${borderColor} ${isDark ? "bg-zinc-900" : "bg-zinc-50"} p-8 text-center`}>
          <p className={`font-mono text-xs ${muted}`}>
            [CAPTURE NEEDED] Screenshot: full Overlay app window, Chat tab open, dark mode, 1400×900px, no OS chrome. Save as /assets/window-screens/chat-screen.png
          </p>
        </div>

        {/* Floating chat overlay */}
        <motion.div
          initial={{ opacity: 0, x: 30, y: 10 }}
          whileInView={{ opacity: 1, x: 0, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="absolute -bottom-6 -right-2 w-2/5 max-w-[280px] md:-right-8"
        >
          <div className={`flex h-28 items-center justify-center border border-dashed ${borderColor} ${isDark ? "bg-zinc-900" : "bg-zinc-50"} p-3 text-center`}>
            <p className={`font-mono text-[9px] leading-tight ${muted}`}>
              [CAPTURE NEEDED] Floating Overlay mini-window over a code editor, transparent BG PNG. Save as /assets/overlays/chat-overlay.png
            </p>
          </div>
        </motion.div>
      </motion.div>

      {/* Model trust strip */}
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className={`w-full border-t pt-10 ${borderColor}`}
      >
        <p className={`mb-4 text-center font-serif text-sm ${muted}`}>
          powered by the world&apos;s best models
        </p>
        <div className="overflow-hidden">
          <div className="flex shrink-0 gap-10 whitespace-nowrap animate-marquee-slow">
            {[...MODELS, ...MODELS].map((m, i) => (
              <span key={i} className={`text-sm font-light ${muted}`}>
                {m}
              </span>
            ))}
          </div>
        </div>
      </motion.div>
    </section>
  );
}
