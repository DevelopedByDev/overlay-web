"use client";

import { Brain, FileText, Link2, StickyNote } from "lucide-react";
import { motion } from "framer-motion";

const FEATURES = [
  {
    Icon: FileText,
    label: "files",
    desc: "upload docs, images, and code — reference them in any conversation",
  },
  {
    Icon: Brain,
    label: "memories",
    desc: "the ai learns your preferences and context across every session",
  },
  {
    Icon: StickyNote,
    label: "notes",
    desc: "capture ideas inline — formatted, linked, and always searchable",
  },
  {
    Icon: Link2,
    label: "integrations",
    desc: "connect your stack — gmail, slack, github, notion and more",
  },
];

const sectionInView = {
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
};

export function ContextHub({ theme }: { theme: "light" | "dark" }) {
  const isDark = theme === "dark";
  const muted = isDark ? "text-zinc-400" : "text-[#71717a]";
  const heading = isDark ? "text-zinc-100" : "text-[#0a0a0a]";
  const cardBg = isDark ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200";
  const iconColor = isDark ? "text-zinc-400" : "text-zinc-600";

  return (
    <motion.section
      {...sectionInView}
      className="relative z-10 flex min-h-[70vh] flex-col items-center justify-center gap-12 px-6 py-20"
    >
      <div className="flex flex-col items-center gap-3 text-center">
        <h2 className={`font-serif text-4xl md:text-5xl lg:text-6xl ${heading}`}>
          all your context, always there
        </h2>
        <p className={`max-w-md text-base md:text-lg ${muted}`}>
          files, memories, notes, integrations — the ai remembers so you don&apos;t have to
        </p>
      </div>

      <div className="grid w-full max-w-2xl grid-cols-2 gap-px border border-[var(--border)]">
        {FEATURES.map((f, i) => (
          <motion.div
            key={f.label}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.4, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
            className={`flex flex-col gap-3 p-6 ${cardBg}`}
          >
            <f.Icon className={`h-5 w-5 ${iconColor}`} />
            <div>
              <p className={`text-sm font-medium ${heading}`}>{f.label}</p>
              <p className={`mt-1 text-sm leading-relaxed ${muted}`}>{f.desc}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
}
