"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { ChatDemo } from "./ChatDemo";

const MODELS = [
  { name: "GPT-5.2", color: "#10a37f" },
  { name: "Claude Opus 4.6", color: "#d97706" },
  { name: "Gemini 3.1 Pro", color: "#4285f4" },
  { name: "Grok 4.20", color: "#7c3aed" },
];

const sectionInView = {
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.3 },
  transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
};

export function ModelsShowcase({ theme }: { theme: "light" | "dark" }) {
  const isDark = theme === "dark";
  const muted = isDark ? "text-zinc-400" : "text-[#71717a]";
  const heading = isDark ? "text-zinc-100" : "text-[#0a0a0a]";
  const bubbleBg = isDark ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200";
  const bubbleText = isDark ? "text-zinc-100" : "text-[#0a0a0a]";
  const borderColor = isDark ? "border-zinc-800" : "border-zinc-200";

  const [modelIdx, setModelIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setModelIdx((i) => (i + 1) % MODELS.length);
    }, 1800);
    return () => clearInterval(id);
  }, []);

  const model = MODELS[modelIdx];

  return (
    <motion.section
      {...sectionInView}
      className="relative z-10 flex min-h-[80vh] flex-col items-center justify-center gap-12 px-6 py-20"
    >
      <div className="flex flex-col items-center gap-3 text-center">
        <h2 className={`font-serif text-4xl md:text-5xl lg:text-6xl ${heading}`}>
          the best models, one conversation
        </h2>
        <p className={`max-w-md text-base md:text-lg ${muted}`}>
          switch between frontier models mid-thread. no extra subscriptions.
        </p>
      </div>

      <div className="flex w-full max-w-3xl flex-col items-center gap-8 md:flex-row md:items-start">
        {/* Model carousel chat bubble */}
        <div className="flex w-full flex-col gap-3 md:w-1/2">
          {/* User bubble — right aligned */}
          <div className={`self-end border px-4 py-3 ${bubbleBg}`}>
            <p className={`text-sm ${bubbleText}`}>
              what&apos;s the best approach for this problem?
            </p>
          </div>
          {/* AI response bubble — left aligned */}
          <div className={`relative self-start max-w-[85%] border px-4 py-3 ${bubbleBg}`}>
            <div className="mb-2 flex items-center gap-2">
              <AnimatePresence mode="wait">
                <motion.span
                  key={model.name}
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.28, ease: "easeInOut" }}
                  className="px-2.5 py-0.5 text-xs font-medium text-white"
                  style={{ backgroundColor: model.color }}
                >
                  {model.name}
                </motion.span>
              </AnimatePresence>
            </div>
            <p className={`text-sm ${bubbleText}`}>
              I&apos;d recommend a divide-and-conquer strategy — break the problem into subproblems,
              solve each independently, then merge the results.
            </p>
          </div>
          {/* User bubble — right aligned */}
          <div className={`self-end border px-4 py-3 ${bubbleBg}`}>
            <p className={`text-sm ${bubbleText}`}>can you show me with code?</p>
          </div>
          {/* AI response — left aligned */}
          <div className={`relative self-start max-w-[85%] border px-4 py-3 ${bubbleBg}`}>
            <AnimatePresence mode="wait">
              <motion.div
                key={model.name + "-code"}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.28 }}
                className="mb-2 flex items-center gap-2"
              >
                <span
                  className="px-2.5 py-0.5 text-xs font-medium text-white"
                  style={{ backgroundColor: model.color }}
                >
                  {model.name}
                </span>
              </motion.div>
            </AnimatePresence>
            <p className={`font-mono text-xs ${muted}`}>
              {`function solve(arr) {\n  if (arr.length <= 1) return arr;\n  const mid = Math.floor(arr.length / 2);\n  return merge(solve(arr.slice(0, mid)),\n               solve(arr.slice(mid)));\n}`}
            </p>
          </div>
        </div>

        {/* Live chat demo */}
        <div className="w-full md:w-1/2">
          <ChatDemo theme={theme} />
        </div>
      </div>
    </motion.section>
  );
}
