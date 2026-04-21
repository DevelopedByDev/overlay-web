'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { PageNavbar } from '@/components/PageNavbar'
import { LandingThemeProvider, useLandingTheme } from '@/contexts/LandingThemeContext'

type ManifestoSection = {
  title: string
  index: string
  paragraphs: string[]
}

/** One visual line per sentence; keeps copy editable as natural paragraphs in source. */
function linesFromSentences(paragraphs: string[]): string[] {
  const out: string[] = []
  for (const block of paragraphs) {
    try {
      const segmenter = new Intl.Segmenter('en', { granularity: 'sentence' })
      for (const { segment } of segmenter.segment(block)) {
        const s = segment.trim()
        if (s) out.push(s)
      }
    } catch {
      for (const s of block.split(/(?<=[.!?])\s+/)) {
        const t = s.trim()
        if (t) out.push(t)
      }
    }
  }
  return out
}

const manifestoSections: ManifestoSection[] = [
  {
    title: 'origins',
    index: '00',
    paragraphs: [
      'I came to America for college.',
      'Johns Hopkins, biomedical engineering.',
      'I thought I was going to build something in medicine.',
      "Then I got obsessed with interfaces.",
      "Not because they're pretty. Because they're the closest thing to the human.",
      'The greatest lever for making revolutionary technology actually reach people.',
      'The personal computer needed the operating system.',
      'The internet needed the web browser.',
      'AI needs the interface layer.',
      'Without the right interface, even the most potent technology creates no real value.',
      'So I started building.',
      'First, an open source voice dictation tool. An alternative to tools people were paying too much for.',
      'It got traction. I got addicted.',
      'And I started seeing a bigger problem.',
      'AI had arrived.',
      'The most transformative technology in human history.',
      'And it was being locked up.',
    ],
  },
  {
    title: 'the problem',
    index: '01',
    paragraphs: [
      'AI is not actually accessible.',
      'The best models live behind separate subscriptions, separate interfaces, separate data silos.',
      'The frontier shifts every month. A new GPT, Claude, or Gemini wrestles the others for the top spot.',
      'Every time it shifts, you pay the tax again.',
      'New account.',
      'New context.',
      'New workflow rebuilt from scratch.',
      'Inside a product designed to trap you.',
      'Your data trains their models.',
      'Your context lives on their servers.',
      'Your productivity funds their moats.',
      'And the interfaces? Built by labs whose core competency is research, not design.',
      'It shows.',
    ],
  },
  {
    title: 'the belief',
    index: '02',
    paragraphs: [
      'The interface layer is where power actually lives.',
      'Not the models. Those are becoming commodities.',
      'The surface closest to the human is the most important one.',
      "Right now it's controlled by the wrong people.",
      'Open source wins.',
      'Always.',
      "Not because it's the right thing to do, though it is, but because it's how every platform war has ended.",
      'Chrome beat Explorer.',
      'VS Code beat JetBrains.',
      'More devices run Android and Linux than macOS, Windows, and iOS combined.',
      'The pattern is consistent: open, extensible platforms become the standard.',
      'Users get to shape them, build on them, own them.',
      'Closed ones become cautionary tales.',
      'Users get locked out while the platform optimizes against them.',
      'The open source model revolution is coming.',
      'The local model revolution is coming.',
      'The idea that any walled garden can keep up with a decentralized, community-driven ecosystem is the same mistake Microsoft made in the nineties.',
      'The aggregator wins this space.',
      'And the best aggregator will be the open one.',
    ],
  },
  {
    title: "what we're building",
    index: '03',
    paragraphs: [
      'One surface for everything AI.',
      'Text, images, video.',
      'Agents, automations, apps.',
      'Your memory, your files, your integrations.',
      'Persistent, portable, owned by you.',
      'Think about what Chrome did for the web.',
      'It opened the platform.',
      'Developers built on top of it.',
      'Extensions made it more useful than any single team could have imagined.',
      'The browser became the operating system of the internet.',
      'Overlay is that for AI.',
      'Open source so you can trust it.',
      'Extensible so the community can grow it beyond what we can build alone.',
      'A place where questions get answered.',
      'Where real work gets done.',
      "Where developers ship graphical agentic apps to an audience that's already there.",
      'Toward software abundance.',
    ],
  },
  {
    title: 'the big question',
    index: '04',
    paragraphs: [
      "People ask: isn't this just a wrapper?",
      'Yes.',
      "But it's the final one.",
      'The big labs are not incentivized to aggregate their competitors.',
      'Their comparative advantage is research, not interfaces.',
      "They will never build the open standard because an open standard works against everything they're optimizing for.",
    ],
  },
  {
    title: "who's it for",
    index: '05',
    paragraphs: [
      'The creator who wants the best generation tools in one place without five subscriptions.',
      'The entrepreneur who wants to move fast without getting locked in.',
      'The developer who runs local models and owns every part of their stack.',
      "The enterprise that can't hand a black box its proprietary data.",
      "The builder who wants to ship the next great agentic app to an audience that's already there.",
      'Everyone the current system treats as an afterthought.',
    ],
  },
  {
    title: 'why this matters',
    index: '06',
    paragraphs: [
      'Software should be owned by the people who use it.',
      'Extended by the people who build on it.',
      "Trusted because it's open.",
      'The labs are building the models.',
      "That's good.",
      'But they are not going to build the interface the world deserves.',
      "That's not what they're for.",
      'We are.',
    ],
  },
  {
    title: 'ubuntu: humanity to others',
    index: '07',
    paragraphs: [
      'Use it.',
      'Build on it.',
      'Contribute.',
      "Tell us what's broken.",
      "We'll fix it together.",
      'The window to build the open standard for AI interfaces is open right now.',
      "We're walking through it.",
      "The future of AI isn't locked in a lab.",
      "It's open.",
      "It's Overlay.",
    ],
  },
]

function ManifestoContent() {
  const { isLandingDark } = useLandingTheme()
  const body = isLandingDark ? 'text-zinc-400' : 'text-zinc-600'
  const heading = isLandingDark ? 'text-zinc-100' : 'text-zinc-900'
  const sub = isLandingDark ? 'text-zinc-400' : 'text-zinc-500'
  const footBorder = isLandingDark ? 'border-zinc-800' : 'border-zinc-200'
  const linkHover = isLandingDark ? 'hover:text-zinc-100' : 'hover:text-zinc-900'
  const divider = isLandingDark ? 'border-zinc-800' : 'border-zinc-200/80'

  const titleClass = `font-serif text-3xl sm:text-4xl md:text-5xl tracking-tight ${heading}`

  return (
    <div className="flex min-h-screen w-full flex-col overflow-x-hidden gradient-bg">
      <div className="liquid-glass" />

      <PageNavbar />

      <main className="relative z-10 flex flex-1 flex-col items-center px-6 py-16 sm:px-8">
        <div className="mx-auto w-full max-w-3xl text-left">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-16 sm:mb-20"
          >
            <h1 className={`mb-5 text-5xl tracking-tight sm:text-6xl md:text-7xl ${heading} font-serif`}>
              manifesto
            </h1>
            <p className={`text-lg font-light tracking-wide md:text-xl ${sub}`}>
              the open, unified AI interaction layer
            </p>
          </motion.div>

          <motion.article
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="flex w-full flex-col"
          >
            {manifestoSections.map((section, si) => {
              const lines = linesFromSentences(section.paragraphs)
              return (
                <div key={section.title} className="w-full">
                  {si > 0 ? <hr className={`my-14 border-0 border-t sm:my-20 ${divider}`} /> : null}
                  <section className="w-full text-left">
                    <h2
                      className={`group relative mb-8 inline-block cursor-default sm:mb-10 ${titleClass}`}
                    >
                      <span
                        aria-hidden
                        className={`pointer-events-none absolute bottom-full left-0 mb-2 whitespace-nowrap font-serif text-3xl leading-none tracking-tight opacity-0 transition-opacity duration-300 sm:text-4xl md:text-5xl group-hover:opacity-100 ${sub}`}
                      >
                        {section.index}
                      </span>
                      {section.title}
                    </h2>
                    <div className="flex w-full flex-col gap-3 sm:gap-4">
                      {lines.map((line, li) => (
                        <p key={`${si}-${li}`} className={`text-base leading-relaxed sm:text-lg ${body}`}>
                          {line}
                        </p>
                      ))}
                    </div>
                  </section>
                </div>
              )
            })}

            <hr className={`my-14 w-full border-0 border-t sm:my-20 ${divider}`} />

            <footer className={`flex flex-col gap-1 pb-4 font-serif text-base sm:text-lg ${heading}`}>
              <p className="font-medium">Divyansh (Dev) Lalwani</p>
              <p className={`text-sm font-normal sm:text-base ${sub}`}>Chief Open Sourcer(er)</p>
              <p className={`text-sm font-normal sm:text-base ${sub}`}>Overlay, LayerNorm Inc</p>
            </footer>
          </motion.article>
        </div>
      </main>

      <footer className={`relative z-10 mt-auto border-t py-8 px-8 ${footBorder}`}>
        <div
          className={`mx-auto grid max-w-4xl grid-cols-1 gap-4 text-sm md:grid-cols-3 md:items-center ${sub}`}
        >
          <p className="text-center md:text-left">© 2026 overlay</p>
          <p className="text-center">
            <a
              href="https://layernorm.co"
              target="_blank"
              rel="noopener noreferrer"
              className={`transition-colors ${linkHover}`}
            >
              made with love by{' '}
              <span
                className={`underline decoration-zinc-400 underline-offset-4 sm:underline-offset-[6px] ${isLandingDark ? 'decoration-zinc-500 hover:decoration-zinc-200' : 'hover:decoration-zinc-700'}`}
              >
                LayerNorm
              </span>
            </a>
          </p>
          <div className="flex justify-center gap-6 md:justify-end">
            <Link href="/terms" className={`transition-colors ${linkHover}`}>
              terms
            </Link>
            <Link href="/privacy" className={`transition-colors ${linkHover}`}>
              privacy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default function ManifestoPage() {
  return (
    <LandingThemeProvider>
      <ManifestoContent />
    </LandingThemeProvider>
  )
}
