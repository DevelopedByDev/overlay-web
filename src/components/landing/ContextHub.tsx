"use client";

import { motion } from "framer-motion";
import { ContextCanvas } from "@/components/landing/ProductCanvases";

const CONTEXT_ITEMS = [
  { label: "Notes", value: "voice notes, drafts, scratchpads" },
  { label: "Knowledge", value: "files, memories, outputs" },
  { label: "Integrations", value: "Gmail, GitHub, Calendar, MCPs" },
  { label: "Projects", value: "shared context across workstreams" },
];

export function ContextHub({ theme }: { theme: "light" | "dark" }) {
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
      <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[minmax(0,0.88fr)_minmax(420px,1.12fr)] lg:items-center">
        <div>
          <p className={`text-xs uppercase tracking-[0.24em] ${muted}`}>Have all your context in one place</p>
          <h2 className={`mt-4 max-w-sm text-4xl tracking-tight md:text-5xl ${heading}`} style={{ fontFamily: "var(--font-serif)" }}>
            The workspace remembers what matters.
          </h2>
          <p className={`mt-5 max-w-lg text-base leading-7 ${muted}`}>
            Overlay keeps your notes, files, memories, and integrations in one surface so every new task starts with real context instead of a blank prompt.
          </p>
          <div className={`mt-10 grid gap-5 border-t pt-6 ${border}`}>
            {CONTEXT_ITEMS.map((item) => (
              <div key={item.label} className="grid gap-1 md:grid-cols-[140px_minmax(0,1fr)]">
                <p className={`text-sm ${heading}`}>{item.label}</p>
                <p className={`text-sm leading-6 ${muted}`}>{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        <ContextCanvas isDark={isDark} />
      </div>
    </motion.section>
  );
}
