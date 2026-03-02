'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { PageNavbar } from '@/components/PageNavbar'

export default function ManifestoPage() {
  return (
    <div className="min-h-screen gradient-bg flex flex-col">
      <div className="liquid-glass" />

      {/* Header */}
      <PageNavbar />

      {/* Main Content */}
      <main className="relative z-10 px-8 py-16 flex-1">
        <div className="max-w-3xl mx-auto">
          {/* Hero */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-20"
          >
            <h1 className="text-5xl md:text-6xl font-serif mb-6">
              The Overlay Manifesto
            </h1>
            <p className="text-xl text-[var(--muted)] max-w-2xl mx-auto">
              A new paradigm for how humans and AI work together
            </p>
          </motion.div>

          {/* Manifesto Content */}
          <motion.article
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="space-y-16"
          >
            {/* Section 1 */}
            <section className="space-y-6">
              <h2 className="text-3xl font-serif">The Problem</h2>
              <div className="space-y-4 text-lg text-[var(--muted)] leading-relaxed">
                <p>
                  Today&apos;s AI tools are scattered across dozens of apps, tabs, and interfaces. 
                  Every task requires context switching. Every conversation starts from scratch. 
                  Your AI doesn&apos;t know what you were working on five minutes ago.
                </p>
                <p>
                  We&apos;ve built powerful AI, but we&apos;ve trapped it behind keyboards and 
                  chat boxes. We&apos;ve created friction where there should be flow.
                </p>
              </div>
            </section>

            {/* Section 2 */}
            <section className="space-y-6">
              <h2 className="text-3xl font-serif">Our Belief</h2>
              <div className="space-y-4 text-lg text-[var(--muted)] leading-relaxed">
                <p>
                  <strong className="text-[var(--foreground)]">AI should be invisible.</strong>{' '}
                  Not hidden, but so seamlessly integrated into your workflow that you forget 
                  it&apos;s there—until you need it.
                </p>
                <p>
                  <strong className="text-[var(--foreground)]">Voice is the natural interface.</strong>{' '}
                  We speak four times faster than we type. Your thoughts shouldn&apos;t wait 
                  for your fingers to catch up.
                </p>
                <p>
                  <strong className="text-[var(--foreground)]">Context is everything.</strong>{' '}
                  An AI that knows your project, your preferences, and your history is 
                  exponentially more useful than one that starts fresh every time.
                </p>
              </div>
            </section>

            {/* Section 3 */}
            <section className="space-y-6">
              <h2 className="text-3xl font-serif">The Overlay Way</h2>
              <div className="space-y-4 text-lg text-[var(--muted)] leading-relaxed">
                <p>
                  Overlay is a unified AI layer that sits on top of everything you do. 
                  One interface. One conversation. One memory.
                </p>
                <p>
                  Press a key and speak. Your notes, chats, browser, and agents all 
                  work together—understanding context, remembering what matters, and 
                  adapting to how <em>you</em> work.
                </p>
              </div>
            </section>

            {/* Principles */}
            <section className="space-y-8">
              <h2 className="text-3xl font-serif">Principles</h2>
              
              <div className="grid gap-8">
                <div className="glass-dark rounded-2xl p-8">
                  <h3 className="text-xl font-medium mb-3">Voice-First, Not Voice-Only</h3>
                  <p className="text-[var(--muted)]">
                    Voice is our primary input, but the keyboard is always there when you need it. 
                    We optimize for the fastest path from thought to action.
                  </p>
                </div>

                <div className="glass-dark rounded-2xl p-8">
                  <h3 className="text-xl font-medium mb-3">Local-First Privacy</h3>
                  <p className="text-[var(--muted)]">
                    Your data lives on your device. We use local models where possible and only 
                    send what&apos;s necessary to the cloud. Your conversations are yours.
                  </p>
                </div>

                <div className="glass-dark rounded-2xl p-8">
                  <h3 className="text-xl font-medium mb-3">Model Agnostic</h3>
                  <p className="text-[var(--muted)]">
                    We don&apos;t lock you into one AI provider. Use Claude, GPT, Gemini, or our 
                    optimized Trinity models. The best model for each task, automatically.
                  </p>
                </div>

                <div className="glass-dark rounded-2xl p-8">
                  <h3 className="text-xl font-medium mb-3">Reduce Friction, Not Work</h3>
                  <p className="text-[var(--muted)]">
                    We&apos;re not here to replace your thinking. We&apos;re here to remove the 
                    busywork between your ideas and their execution.
                  </p>
                </div>
              </div>
            </section>

            {/* Vision */}
            <section className="space-y-6">
              <h2 className="text-3xl font-serif">The Vision</h2>
              <div className="space-y-4 text-lg text-[var(--muted)] leading-relaxed">
                <p>
                  We imagine a world where AI is your always-present collaborator. Where switching 
                  contexts doesn&apos;t mean losing context. Where your computer actually 
                  understands what you&apos;re trying to do.
                </p>
                <p>
                  Overlay is the first step toward that world. A unified, voice-powered AI layer 
                  that works the way you think.
                </p>
              </div>
            </section>

            {/* CTA */}
            <section className="text-center pt-8">
              <Link
                href="/#download"
                className="inline-flex items-center gap-3 px-8 py-4 bg-[var(--foreground)] text-[var(--background)] rounded-full text-lg font-medium hover:opacity-90 transition-opacity"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                </svg>
                Download Overlay
              </Link>
              <p className="mt-4 text-sm text-[var(--muted)]">
                Free to start. Available for macOS.
              </p>
            </section>
          </motion.article>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-8 px-8 border-t border-zinc-200 mt-auto">
        <div className="max-w-4xl mx-auto flex items-center justify-between text-sm text-[var(--muted)]">
          <p>© 2026 overlay</p>
          <div className="flex gap-6">
            <Link href="/terms" className="hover:text-[var(--foreground)] transition-colors">
              terms
            </Link>
            <Link href="/privacy" className="hover:text-[var(--foreground)] transition-colors">
              privacy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
