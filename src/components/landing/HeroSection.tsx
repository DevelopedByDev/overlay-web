"use client";

import { motion } from "framer-motion";
import { Github, Globe } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

const MODELS = [
  "GPT-4o",
  "Claude Sonnet",
  "Gemini 2.5",
  "Grok-3",
  "Flux",
  "Sora",
  "Llama 3.3",
  "Mistral",
  "DeepSeek R2",
  "DALL·E 3",
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
          <a
            href="https://github.com/DevelopedByDev/overlay-web"
            target="_blank"
            rel="noopener noreferrer"
            className={`overlay-interactive inline-flex items-center justify-center gap-2 border px-7 py-3 text-sm font-medium ${
              isDark
                ? "border-zinc-600 text-zinc-300"
                : "border-zinc-300 text-[#0a0a0a]"
            }`}
          >
            <Github className="h-4 w-4" />
            view source
          </a>
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
        <div className={`relative overflow-hidden border ${borderColor}`}>
          <Image
            src="/assets/window-screens/chat-screen.png"
            alt="Overlay chat interface"
            width={1200}
            height={750}
            className="w-full"
            priority
          />
        </div>

        {/* Floating chat overlay */}
        <motion.div
          initial={{ opacity: 0, x: 30, y: 10 }}
          whileInView={{ opacity: 1, x: 0, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="absolute -bottom-6 -right-2 w-2/5 max-w-[280px] md:-right-8"
        >
          <div className={`overflow-hidden border ${borderColor}`}>
            <Image
              src="/assets/overlays/chat-overlay.png"
              alt="Overlay floating panel"
              width={600}
              height={400}
              className="w-full"
            />
          </div>
        </motion.div>
      </motion.div>

      {/* Model trust strip */}
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="w-full overflow-hidden pt-4"
      >
        <p className={`mb-3 text-center text-xs font-medium uppercase tracking-widest ${muted}`}>
          powered by the world&apos;s best models
        </p>
        <div className="flex overflow-hidden">
          <motion.div
            animate={{ x: ["0%", "-50%"] }}
            transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
            className="flex shrink-0 gap-10 whitespace-nowrap"
          >
            {[...MODELS, ...MODELS].map((m, i) => (
              <span key={i} className={`text-sm font-light ${muted}`}>
                {m}
              </span>
            ))}
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}
