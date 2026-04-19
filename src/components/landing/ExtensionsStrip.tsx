"use client";

import { motion } from "framer-motion";

const CAPABILITIES = [
  "chat",
  "voice notes",
  "browser",
  "agents",
  "automations",
  "context",
  "files",
  "outputs",
  "integrations",
  "open source",
];

export function ExtensionsStrip({ theme }: { theme: "light" | "dark" }) {
  const isDark = theme === "dark";
  const heading = isDark ? "text-zinc-100" : "text-zinc-950";
  const border = isDark ? "border-white/10" : "border-black/8";

  return (
    <motion.section
      id="product"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.35 }}
      transition={{ duration: 0.52, ease: [0.22, 1, 0.36, 1] }}
      className="relative z-10 px-6 py-16 md:px-8 md:py-20"
    >
      <div className={`mx-auto max-w-7xl border-y py-8 ${border}`}>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)] lg:items-end">
          <div>
            <h2 className={`max-w-sm text-4xl tracking-tight md:text-5xl ${heading}`} style={{ fontFamily: "var(--font-serif)" }}>
              One surface, not five separate tools.
            </h2>
          </div>

          <div className="overflow-hidden">
            <motion.div
              animate={{ x: ["0%", "-50%"] }}
              transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
              className="flex shrink-0 gap-3 whitespace-nowrap"
            >
              {[...CAPABILITIES, ...CAPABILITIES].map((item, index) => (
                <span
                  key={`${item}-${index}`}
                  className={`inline-flex items-center rounded-full border px-4 py-2 text-sm ${border} ${
                    isDark ? "bg-white/[0.03] text-zinc-300" : "bg-black/[0.02] text-zinc-700"
                  }`}
                >
                  {item}
                </span>
              ))}
            </motion.div>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
