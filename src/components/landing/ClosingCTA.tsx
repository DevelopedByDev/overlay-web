"use client";

import { motion } from "framer-motion";
import { Globe } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

const sectionInView = {
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.25 },
  transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
};

export function ClosingCTA({
  theme,
  webAppHref,
}: {
  theme: "light" | "dark";
  webAppHref: string;
}) {
  const isDark = theme === "dark";
  const muted = isDark ? "text-zinc-400" : "text-[#71717a]";
  const heading = isDark ? "text-zinc-100" : "text-[#0a0a0a]";

  return (
    <motion.section
      {...sectionInView}
      className="relative z-10 flex min-h-screen flex-col px-6 pb-16 pt-20"
    >
      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <h2 className={`font-serif text-5xl md:text-6xl lg:text-7xl ${heading}`}>begin</h2>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href={webAppHref}
            className={
              isDark
                ? "inline-flex items-center justify-center gap-2 rounded-full bg-zinc-100 px-8 py-4 text-sm font-medium text-zinc-900 transition-all hover:bg-white"
                : "inline-flex items-center justify-center gap-2 rounded-full bg-[#0a0a0a] px-8 py-4 text-sm font-medium text-white transition-all hover:bg-[#27272a]"
            }
          >
            <Globe className="h-4 w-4" />
            open app
          </Link>
          <a
            href="#"
            className={
              isDark
                ? "inline-flex items-center justify-center gap-2 rounded-full border border-zinc-600 px-8 py-4 text-sm font-medium text-zinc-300 transition-all hover:bg-zinc-800"
                : "inline-flex items-center justify-center gap-2 rounded-full border border-[#d4d4d8] px-8 py-4 text-sm font-medium text-[#0a0a0a] transition-all hover:bg-[#f4f4f5]"
            }
          >
            download for mac
          </a>
        </div>
        <p className={`text-sm ${isDark ? "text-zinc-500" : "text-[#a1a1aa]"}`}>
          desktop download coming soon
        </p>
      </div>

      <footer
        className={`mt-auto w-full max-w-4xl self-center border-t pt-12 ${
          isDark ? "border-zinc-800" : "border-zinc-200"
        }`}
      >
        <div className="flex flex-col items-stretch justify-between gap-4 px-0 pb-4 md:flex-row md:items-center">
          <div className="flex items-center gap-3">
            <Image
              src="/assets/overlay-logo.png"
              alt="Overlay"
              width={24}
              height={24}
              className="opacity-60"
            />
            <p className={`text-sm ${muted}`}>© 2026 overlay</p>
          </div>
          <p className={`text-sm ${muted}`}>
            made with care by{" "}
            <a
              href="https://divyan.sh"
              target="_blank"
              rel="noopener noreferrer"
              className={`underline transition-colors ${isDark ? "hover:text-zinc-200" : "hover:text-[#0a0a0a]"}`}
            >
              divyan.sh
            </a>
          </p>
          <div className="flex gap-8">
            <a
              href="/terms"
              className={`text-sm transition-colors ${muted} ${isDark ? "hover:text-zinc-200" : "hover:text-[#0a0a0a]"}`}
            >
              terms
            </a>
            <a
              href="/privacy"
              className={`text-sm transition-colors ${muted} ${isDark ? "hover:text-zinc-200" : "hover:text-[#0a0a0a]"}`}
            >
              privacy
            </a>
            <a
              href="mailto:divyansh@layernorm.co"
              className={`text-sm transition-colors ${muted} ${isDark ? "hover:text-zinc-200" : "hover:text-[#0a0a0a]"}`}
            >
              contact
            </a>
          </div>
        </div>
      </footer>
    </motion.section>
  );
}
