"use client";

import { motion } from "framer-motion";

const OUTPUT_TYPES = [
  { label: "Image", detail: "Generate, refine, and version visual concepts." },
  { label: "Video", detail: "Turn scripts and ideas into render-ready outputs." },
  { label: "Audio", detail: "Capture voice, transcripts, and sound-driven prompts." },
  { label: "Docs", detail: "Draft summaries, briefs, and structured deliverables." },
];

export function CreationBento({ theme }: { theme: "light" | "dark" }) {
  const isDark = theme === "dark";
  const muted = isDark ? "text-zinc-400" : "text-zinc-600";
  const heading = isDark ? "text-zinc-100" : "text-zinc-950";
  const border = isDark ? "border-white/10" : "border-black/8";

  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.52, ease: [0.22, 1, 0.36, 1] }}
      className="relative z-10 px-6 py-20 md:px-8 md:py-24"
    >
      <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[minmax(0,0.72fr)_minmax(460px,1.28fr)] lg:items-center">
        <div>
          <p className={`text-xs uppercase tracking-[0.24em] ${muted}`}>Generate content autonomously</p>
          <h2 className={`mt-4 max-w-sm text-4xl tracking-tight md:text-5xl ${heading}`} style={{ fontFamily: "var(--font-serif)" }}>
            Outputs belong in the same workspace as the prompt.
          </h2>
          <p className={`mt-5 max-w-lg text-base leading-7 ${muted}`}>
            Draft, render, revise, and store text, images, video, and audio without breaking context or losing the history behind the work.
          </p>
        </div>

        <div className={`overflow-hidden rounded-[34px] border ${border} ${isDark ? "bg-[#0d0d10]/84" : "bg-white/84"} backdrop-blur-xl`}>
          <div className={`border-b px-5 py-4 ${border}`}>
            <p className={`text-xs uppercase tracking-[0.24em] ${muted}`}>Output studio</p>
          </div>
          <div className="grid gap-4 p-4 md:grid-cols-[1.1fr_0.9fr]">
            <div className={`rounded-[28px] border p-5 ${border} ${isDark ? "bg-white/[0.03]" : "bg-black/[0.02]"}`}>
              <p className={`text-xs uppercase tracking-[0.22em] ${muted}`}>Active generation</p>
              <div className="mt-8 flex h-[220px] items-end gap-2 rounded-[24px] bg-gradient-to-br from-emerald-500/15 via-sky-500/10 to-transparent px-5 pb-6">
                {[42, 70, 58, 92, 64, 88, 76, 54, 67, 85, 60, 74].map((height, index) => (
                  <motion.div
                    key={`${height}-${index}`}
                    className={`w-full rounded-full ${isDark ? "bg-zinc-100/75" : "bg-zinc-900/78"}`}
                    style={{ height }}
                    animate={{ scaleY: [0.88, 1.08, 0.95, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity, delay: index * 0.06, ease: [0.65, 0, 0.35, 1] }}
                  />
                ))}
              </div>
            </div>

            <div className="grid gap-4">
              {OUTPUT_TYPES.map((item, index) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, x: 18 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, amount: 0.25 }}
                  transition={{ duration: 0.42, delay: index * 0.07, ease: [0.22, 1, 0.36, 1] }}
                  className={`rounded-[24px] border px-4 py-4 ${border} ${isDark ? "bg-white/[0.03]" : "bg-white"}`}
                >
                  <p className={`text-sm ${heading}`}>{item.label}</p>
                  <p className={`mt-2 text-sm leading-6 ${muted}`}>{item.detail}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
