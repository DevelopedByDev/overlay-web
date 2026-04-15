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
  const borderColor = isDark ? "border-zinc-800" : "border-zinc-200";

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
            className={`overlay-interactive inline-flex items-center justify-center gap-2 border px-8 py-4 text-sm font-medium ${
              isDark
                ? "border-zinc-100 bg-zinc-100 text-zinc-900"
                : "border-[#0a0a0a] bg-[#0a0a0a] text-white"
            }`}
          >
            <Globe className="h-4 w-4" />
            open app
          </Link>
        </div>
      </div>

      <footer className={`mt-auto w-full max-w-4xl self-center border-t pt-12 ${borderColor}`}>
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
              className={`underline underline-offset-4 transition-colors ${isDark ? "hover:text-zinc-200" : "hover:text-[#0a0a0a]"}`}
            >
              divyan.sh
            </a>
          </p>
          <div className="flex gap-8">
            {[
              { href: "/terms", label: "terms" },
              { href: "/privacy", label: "privacy" },
              { href: "mailto:divyansh@layernorm.co", label: "contact" },
            ].map(({ href, label }) => (
              <a
                key={label}
                href={href}
                className={`text-sm transition-colors ${muted} ${isDark ? "hover:text-zinc-200" : "hover:text-[#0a0a0a]"}`}
              >
                {label}
              </a>
            ))}
          </div>
        </div>
      </footer>
    </motion.section>
  );
}
