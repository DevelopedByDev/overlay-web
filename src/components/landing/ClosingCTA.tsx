"use client";

import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { MARKETING_SALES_URL } from "@/lib/marketing";

export function ClosingCTA({
  theme,
  webAppHref,
}: {
  theme: "light" | "dark";
  webAppHref: string;
}) {
  const isDark = theme === "dark";
  const muted = isDark ? "text-zinc-400" : "text-zinc-600";
  const heading = isDark ? "text-zinc-100" : "text-zinc-950";
  const border = isDark ? "border-white/10" : "border-black/8";

  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.52, ease: [0.22, 1, 0.36, 1] }}
      className="relative z-10 px-6 pb-20 pt-10 md:px-8 md:pb-24"
    >
      <div className={`mx-auto max-w-7xl border-t pt-10 ${border}`}>
        <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <p className={`text-xs uppercase tracking-[0.24em] ${muted}`}>Start here</p>
            <h2 className={`mt-4 text-4xl tracking-tight md:text-5xl ${heading}`} style={{ fontFamily: "var(--font-serif)" }}>
              Stop rebuilding your AI stack in every separate product.
            </h2>
            <p className={`mt-5 max-w-xl text-base leading-7 ${muted}`}>
              Bring chat, voice notes, browser tasks, automations, and outputs into one open-source interaction layer.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={webAppHref}
              className={
                isDark
                  ? "inline-flex items-center rounded-full bg-zinc-100 px-5 py-3 text-sm text-zinc-950 transition-colors hover:bg-white"
                  : "inline-flex items-center rounded-full bg-zinc-950 px-5 py-3 text-sm text-white transition-colors hover:bg-zinc-800"
              }
            >
              Open app
            </Link>
            <a
              href={MARKETING_SALES_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-2 rounded-full border px-5 py-3 text-sm transition-colors ${
                isDark
                  ? "border-white/10 text-zinc-100 hover:bg-white/5"
                  : "border-black/8 text-zinc-950 hover:bg-black/[0.03]"
              }`}
            >
              <span>Contact sales</span>
              <ArrowUpRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
