"use client";

import { motion } from "framer-motion";

const sectionInView = {
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
};

function Badge({ label, isDark }: { label: string; isDark: boolean }) {
  return (
    <span
      className={`px-2.5 py-0.5 text-xs font-medium ${
        isDark ? "bg-zinc-700 text-zinc-300" : "bg-zinc-100 text-zinc-600"
      }`}
    >
      {label}
    </span>
  );
}

export function CreationBento({ theme }: { theme: "light" | "dark" }) {
  const isDark = theme === "dark";
  const muted = isDark ? "text-zinc-400" : "text-[#71717a]";
  const heading = isDark ? "text-zinc-100" : "text-[#0a0a0a]";
  const cardBg = isDark ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200";
  const subText = isDark ? "text-zinc-300" : "text-zinc-700";

  return (
    <motion.section
      {...sectionInView}
      className="relative z-10 flex min-h-[80vh] flex-col items-center justify-center gap-10 px-6 py-20"
    >
      <div className="flex flex-col items-center gap-3 text-center">
        <h2 className={`font-serif text-4xl md:text-5xl lg:text-6xl ${heading}`}>
          create anything
        </h2>
        <p className={`max-w-md text-base md:text-lg ${muted}`}>
          images, videos, audio — generated and refined in one place
        </p>
      </div>

      <div className="grid w-full max-w-4xl grid-cols-1 gap-px border border-[var(--border)] sm:grid-cols-2">
        {/* Image gen */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.5, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
          className={`flex flex-col gap-4 p-6 ${cardBg}`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-sm font-medium ${subText}`}>image generation</span>
            <Badge label="GPT Image" isDark={isDark} />
          </div>
          <div className="relative h-32 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500 via-pink-400 to-orange-300 opacity-90" />
            <div className="absolute bottom-3 left-3 right-3">
              <div
                className={`px-3 py-1.5 text-xs ${
                  isDark ? "bg-zinc-900/80 text-zinc-300" : "bg-white/80 text-zinc-600"
                }`}
              >
                a futuristic city at golden hour, photorealistic...
              </div>
            </div>
          </div>
        </motion.div>

        {/* Video */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className={`flex flex-col gap-4 p-6 ${cardBg}`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-sm font-medium ${subText}`}>video generation</span>
            <Badge label="Sora" isDark={isDark} />
          </div>
          <div className="relative h-32 overflow-hidden bg-zinc-950">
            <div className="absolute inset-y-0 left-0 right-0 flex items-center justify-center gap-1 px-2">
              {[...Array(7)].map((_, i) => (
                <motion.div
                  key={i}
                  className="h-20 flex-1 bg-zinc-700"
                  animate={{ opacity: [0.4, 0.9, 0.4] }}
                  transition={{
                    duration: 1.6,
                    delay: i * 0.18,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
              ))}
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-2xl">🎬</span>
            </div>
          </div>
        </motion.div>

        {/* Audio */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.5, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className={`flex flex-col gap-4 p-6 ${cardBg}`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-sm font-medium ${subText}`}>audio generation</span>
            <Badge label="generate" isDark={isDark} />
          </div>
          <div className="flex h-32 items-center justify-center gap-1 bg-sky-500/10">
            {[3, 6, 9, 14, 10, 7, 12, 8, 5, 11, 9, 6, 13, 7, 4].map((h, i) => (
              <motion.div
                key={i}
                className="w-1.5 bg-sky-500"
                style={{ height: `${h * 4}px` }}
                animate={{ scaleY: [1, 1.6, 0.7, 1.3, 1] }}
                transition={{
                  duration: 1.4,
                  delay: i * 0.08,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
            ))}
          </div>
        </motion.div>

        {/* Text / docs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.5, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className={`flex flex-col gap-4 p-6 ${cardBg}`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-sm font-medium ${subText}`}>text & documents</span>
            <Badge label="export" isDark={isDark} />
          </div>
          <div className="h-32 overflow-hidden p-4">
            <div className="flex flex-col gap-2">
              {["# Project Summary", "## Key Findings", "The analysis shows..."].map((line, i) => (
                <motion.p
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: 0.3 + i * 0.2 }}
                  className={`font-mono text-xs ${i === 0 ? subText : muted}`}
                >
                  {line}
                </motion.p>
              ))}
              <motion.span
                animate={{ opacity: [1, 0, 1] }}
                transition={{ duration: 0.8, repeat: Infinity }}
                className={`h-3.5 w-0.5 ${isDark ? "bg-zinc-300" : "bg-zinc-700"}`}
              />
            </div>
          </div>
        </motion.div>
      </div>
    </motion.section>
  );
}
