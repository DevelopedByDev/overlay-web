"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { ModelCanvas } from "@/components/landing/ProductCanvases";

const MODELS = [
  { name: "Claude Sonnet 4.6", color: "#d97706" },
  { name: "GPT-5", color: "#10a37f" },
  { name: "Gemini 2.5 Pro", color: "#2563eb" },
  { name: "Grok 3", color: "#db2777" },
  { name: "DeepSeek R1", color: "#7c3aed" },
];

export function ModelsShowcase({ theme }: { theme: "light" | "dark" }) {
  const isDark = theme === "dark";
  const muted = isDark ? "text-zinc-400" : "text-zinc-600";
  const heading = isDark ? "text-zinc-100" : "text-zinc-950";
  const border = isDark ? "border-white/10" : "border-black/8";
  const [modelIndex, setModelIndex] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setModelIndex((value) => (value + 1) % MODELS.length);
    }, 1800);
    return () => window.clearInterval(id);
  }, []);

  const model = MODELS[modelIndex];

  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.52, ease: [0.22, 1, 0.36, 1] }}
      className="relative z-10 px-6 py-20 md:px-8 md:py-24"
    >
      <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[minmax(0,0.82fr)_minmax(420px,1.18fr)] lg:items-center">
        <div>
          <p className={`text-xs uppercase tracking-[0.24em] ${muted}`}>Chat with the best models</p>
          <h2 className={`mt-4 max-w-md text-4xl tracking-tight md:text-5xl ${heading}`} style={{ fontFamily: "var(--font-serif)" }}>
            Model choice without model fragmentation.
          </h2>
          <p className={`mt-5 max-w-lg text-base leading-7 ${muted}`}>
            Switch models inside the same thread, compare answers, and keep the same context instead of rebuilding the conversation in every separate lab product.
          </p>
          <div className={`mt-10 border-t pt-6 ${border}`}>
            <AnimatePresence mode="wait">
              <motion.div
                key={model.name}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="max-w-md"
              >
                <span
                  className="inline-flex rounded-full px-3 py-1.5 text-xs uppercase tracking-[0.22em] text-white"
                  style={{ backgroundColor: model.color }}
                >
                  {model.name}
                </span>
                <p className={`mt-4 text-sm leading-6 ${muted}`}>
                  Route a question to the best model for reasoning, vision, code, or speed without leaving the workspace.
                </p>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        <ModelCanvas isDark={isDark} accent={model.color} />
      </div>
    </motion.section>
  );
}
