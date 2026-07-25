import { motion } from 'framer-motion'
import type { AiHomeGreeting, HomeLocale } from '../../lib/aiHome'
import { formatGreetingLines } from '../../lib/aiHome'
import { consultantLine } from '../../lib/premiumExperience'

export interface AiHomeHeroProps {
  greeting: AiHomeGreeting
  locale: HomeLocale
  brandName: string
  brandTagline: string
}

/**
 * Full-bleed conversation-first hero — brand as primary signal.
 */
export function AiHomeHero({ greeting, locale, brandName, brandTagline }: AiHomeHeroProps) {
  const lines = formatGreetingLines(greeting, locale)
  const question = lines[2] || consultantLine(locale, 'whereToday')

  return (
    <section
      className="relative isolate min-h-[58vh] overflow-hidden sm:min-h-[62vh]"
      data-testid="ai-home-hero"
      aria-label={brandName}
    >
      {/* Full-bleed atmospheric plane */}
      <div
        className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_-10%,#1c80f0_0%,#122e57_45%,#0b1628_100%)]"
        aria-hidden
      />
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.04\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -start-24 top-10 h-72 w-72 rounded-full bg-sky-400/20 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -end-16 bottom-0 h-80 w-80 rounded-full bg-cyan-300/10 blur-3xl"
        aria-hidden
      />

      <div className="relative z-10 mx-auto flex max-w-3xl flex-col justify-end px-5 pb-10 pt-16 sm:px-6 sm:pb-14 sm:pt-20">
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          className="text-[11px] font-medium tracking-[0.18em] text-sky-100/80 uppercase"
        >
          {brandTagline}
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.05, ease: 'easeOut' }}
          className="mt-3 text-5xl font-bold tracking-tight text-white sm:text-6xl md:text-7xl"
        >
          {brandName}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.12, ease: 'easeOut' }}
          className="mt-3 text-sm text-sky-100/90 sm:text-base"
        >
          {lines[0]} {lines[1]}
        </motion.p>

        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.2, ease: 'easeOut' }}
          className="mt-6 max-w-xl text-2xl font-semibold leading-snug text-white sm:text-3xl"
        >
          {question}
        </motion.p>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.32 }}
          className="mt-3 max-w-md text-sm leading-relaxed text-sky-100/85"
        >
          {consultantLine(locale, 'dreamTrip')}
        </motion.p>
      </div>
    </section>
  )
}
