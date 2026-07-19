import { useEffect, useState } from 'react'
import type { AiHomeGreeting, HomeLocale } from '../../lib/aiHome'
import { formatGreetingLines } from '../../lib/aiHome'

export interface AiHomeHeroProps {
  greeting: AiHomeGreeting
  locale: HomeLocale
  brandName: string
  brandTagline: string
}

export function AiHomeHero({ greeting, locale, brandName, brandTagline }: AiHomeHeroProps) {
  const lines = formatGreetingLines(greeting, locale)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [])

  return (
    <section
      className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-primary-900 to-primary-700 px-5 py-10 text-white sm:px-8 sm:py-14"
      data-testid="ai-home-hero"
      aria-label={brandName}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(255,255,255,0.12),_transparent_55%)]" />
      <div className="pointer-events-none absolute -start-10 top-8 h-40 w-40 rounded-full bg-accent-400/20 blur-3xl" />
      <div className="pointer-events-none absolute -end-8 bottom-0 h-48 w-48 rounded-full bg-sky-300/15 blur-3xl" />

      <div
        className={`relative z-10 transition-all duration-700 ease-out ${
          visible ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20 backdrop-blur-sm"
            aria-hidden
          >
            <span className="absolute inset-0 animate-ping rounded-2xl bg-accent-300/20" />
            <svg viewBox="0 0 24 24" className="relative h-6 w-6 text-accent-200" fill="currentColor">
              <path d="M12 2l2.5 6.5L21 9l-5 4.5L17.5 21 12 17l-5.5 4L8 13.5 3 9l6.5-.5z" />
            </svg>
          </div>
          <div>
            <p className="text-2xl font-bold tracking-tight sm:text-3xl">{brandName}</p>
            <p className="text-[11px] text-primary-100/90">{brandTagline}</p>
          </div>
        </div>

        <div className="mt-8 max-w-xl space-y-1.5">
          <p className="text-sm font-medium text-primary-100/90 sm:text-base">{lines[0]}</p>
          <p className="text-lg font-semibold sm:text-xl">{lines[1]}</p>
          <p className="text-base text-white/95 sm:text-lg">{lines[2]}</p>
        </div>

        <div className="mt-6 flex items-center gap-2 text-[11px] text-primary-100/80">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-300" />
          </span>
          {locale === 'ar' ? 'مستشار السفر الذكي جاهز' : 'AI travel concierge ready'}
        </div>
      </div>
    </section>
  )
}
