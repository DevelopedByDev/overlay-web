"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { AUDIENCE_PAGES } from "@/lib/marketing";

export function AudienceShowcase({ theme }: { theme: "light" | "dark" }) {
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
      <div className="mx-auto max-w-7xl">
        <div className="max-w-2xl">
          <p className={`text-xs uppercase tracking-[0.24em] ${muted}`}>Overlay for teams and specialized workflows</p>
          <h2 className={`mt-4 text-4xl tracking-tight md:text-5xl ${heading}`} style={{ fontFamily: "var(--font-serif)" }}>
            Different work. Same unified layer.
          </h2>
          <p className={`mt-5 max-w-xl text-base leading-7 ${muted}`}>
            Overlay adapts to enterprise operations, education, content production, and developer workflows without splitting the product into separate silos.
          </p>
        </div>

        <div className={`mt-12 grid gap-5 border-t pt-8 md:grid-cols-2 ${border}`}>
          {AUDIENCE_PAGES.map((page, index) => (
            <motion.div
              key={page.href}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.42, delay: index * 0.07, ease: [0.22, 1, 0.36, 1] }}
            >
              <Link
                href={page.href}
                className={`block rounded-[28px] border px-5 py-5 transition-colors ${
                  border
                } ${isDark ? "bg-white/[0.03] hover:bg-white/[0.05]" : "bg-white/80 hover:bg-white"}`}
              >
                <p className={`text-xs uppercase tracking-[0.24em] ${muted}`}>{page.eyebrow}</p>
                <h3 className={`mt-4 text-3xl tracking-tight ${heading}`} style={{ fontFamily: "var(--font-serif)" }}>
                  {page.label}
                </h3>
                <p className={`mt-4 max-w-md text-sm leading-6 ${muted}`}>{page.summary}</p>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.section>
  );
}
