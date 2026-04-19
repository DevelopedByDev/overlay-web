"use client";

import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { WorkspaceCanvas } from "@/components/landing/ProductCanvases";
import { MARKETING_GITHUB_URL, MARKETING_SALES_URL } from "@/lib/marketing";

const HERO_LABELS = [
  "chat",
  "notes",
  "knowledge",
  "extensions",
  "projects",
  "automations",
];

export function HeroSection({
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
    <section className="relative overflow-hidden px-6 pb-16 pt-28 md:px-8 md:pb-24 md:pt-32">
      <div className="mx-auto grid min-h-[calc(100svh-6.5rem)] max-w-7xl items-center gap-12 lg:grid-cols-[minmax(0,0.76fr)_minmax(540px,1.24fr)]">
        <motion.div
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-2xl"
        >
          <div className="flex items-center gap-3">
            <Image src="/assets/overlay-logo.png" alt="Overlay" width={34} height={34} />
            <span className={`text-sm uppercase tracking-[0.28em] ${muted}`}>overlay</span>
          </div>
          <h1
            className={`mt-8 max-w-[10ch] text-5xl leading-[0.94] tracking-tight md:text-7xl xl:text-[5.4rem] ${heading}`}
            style={{ fontFamily: "var(--font-serif)" }}
          >
            the all-in-one AI workspace.
          </h1>
          <p className={`mt-6 max-w-xl text-base leading-7 md:text-lg ${muted}`}>
            one layer for every serious AI workflow.
          </p>
          <p className={`mt-6 max-w-xl text-sm leading-6 md:text-base ${muted}`}>
            Open-source alternative to ChatGPT, Claude, Perplexity, Computer Use, and Copilot-style assistants.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
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
            <a
              href={MARKETING_GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center rounded-full px-3 py-3 text-sm transition-colors ${
                isDark ? "text-zinc-400 hover:text-zinc-100" : "text-zinc-600 hover:text-zinc-950"
              }`}
            >
              View source
            </a>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.985, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
          className="relative"
        >
          <div className={`overflow-hidden rounded-[28px] border ${border} ${isDark ? "bg-[#111113]" : "bg-[#fcfcfb]"} shadow-[0_18px_48px_rgba(15,23,42,0.06)]`}>
            <div className={`border-b px-5 py-4 ${border}`}>
              <div className="flex flex-wrap gap-1.5">
                {HERO_LABELS.map((label) => (
                  <span
                    key={label}
                    className={`rounded-full border px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] ${
                      isDark ? "border-white/10 text-zinc-400" : "border-black/8 text-zinc-500"
                    }`}
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>
            <div className="p-3">
              <WorkspaceCanvas isDark={isDark} />
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
