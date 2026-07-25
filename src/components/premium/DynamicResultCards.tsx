import { motion } from 'framer-motion'
import {
  buildDynamicResultCards,
  resultCardKindLabel,
  resultCardMeta,
  resultCardSubtitle,
  resultCardTitle,
  type DynamicResultCard,
  type ResultCardKind,
} from '../../lib/premiumExperience'

export interface DynamicResultCardsProps {
  seedText: string
  locale?: 'ar' | 'en'
  limit?: number
  className?: string
}

const ACCENT: Record<string, string> = {
  sky: 'from-sky-500/15 to-sky-500/5 border-sky-200/80',
  teal: 'from-teal-500/15 to-teal-500/5 border-teal-200/80',
  amber: 'from-amber-500/15 to-amber-500/5 border-amber-200/80',
  emerald: 'from-emerald-500/15 to-emerald-500/5 border-emerald-200/80',
  rose: 'from-rose-500/12 to-rose-500/5 border-rose-200/80',
  orange: 'from-orange-500/15 to-orange-500/5 border-orange-200/80',
}

export function DynamicResultCards({
  seedText,
  locale = 'ar',
  limit = 4,
  className = '',
}: DynamicResultCardsProps) {
  const cards = buildDynamicResultCards(seedText, limit)
  if (cards.length === 0) return null

  return (
    <div
      className={`grid grid-cols-1 gap-2.5 sm:grid-cols-2 ${className}`}
      data-testid="dynamic-result-cards"
      role="list"
      aria-label={locale === 'ar' ? 'نتائج الرحلة' : 'Trip results'}
    >
      {cards.map((card, index) => (
        <ResultCardView key={card.id} card={card} locale={locale} index={index} />
      ))}
    </div>
  )
}

function ResultCardView({
  card,
  locale,
  index,
}: {
  card: DynamicResultCard
  locale: 'ar' | 'en'
  index: number
}) {
  const accent = ACCENT[card.accent ?? 'sky'] ?? ACCENT.sky
  return (
    <motion.article
      role="listitem"
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.35, delay: index * 0.07, ease: 'easeOut' }}
      className={`rounded-2xl border bg-gradient-to-br p-3.5 shadow-sm shadow-slate-900/5 ${accent}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="inline-flex items-center rounded-lg bg-white/70 px-2 py-0.5 text-[10px] font-bold tracking-wide text-slate-700 dark:bg-slate-900/50 dark:text-slate-200">
          {resultCardKindLabel(card.kind, locale)}
        </span>
        <KindGlyph kind={card.kind} />
      </div>
      <h3 className="mt-2 text-sm font-bold text-slate-900 dark:text-slate-50">
        {resultCardTitle(card, locale)}
      </h3>
      <p className="mt-0.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
        {resultCardSubtitle(card, locale)}
      </p>
      {resultCardMeta(card, locale) ? (
        <p className="mt-2 text-xs font-semibold text-slate-800 dark:text-slate-100">
          {resultCardMeta(card, locale)}
        </p>
      ) : null}
    </motion.article>
  )
}

function KindGlyph({ kind }: { kind: ResultCardKind }) {
  return (
    <span className="text-slate-500 dark:text-slate-300" aria-hidden>
      {kind === 'flight' && (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M3 12l18-7-4 8 4 3-7-1-3 4-2-5-6-2z" strokeLinejoin="round" />
        </svg>
      )}
      {kind === 'hotel' && (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M4 20V8l8-4 8 4v12M8 20v-6h8v6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {kind === 'weather' && (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" strokeLinecap="round" />
        </svg>
      )}
      {(kind === 'budget'
        || kind === 'activity'
        || kind === 'restaurant'
        || kind === 'map'
        || kind === 'transport'
        || kind === 'visa'
        || kind === 'timeline') && (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="4" y="5" width="16" height="14" rx="2" />
          <path d="M8 9h8M8 13h5" strokeLinecap="round" />
        </svg>
      )}
    </span>
  )
}
