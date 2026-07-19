import type { TravelInsight, ItineraryLocale } from '../../lib/smartItinerary'

const TONE: Record<TravelInsight['tone'], string> = {
  info: 'border-sky-100 bg-sky-50/50',
  tip: 'border-emerald-100 bg-emerald-50/40',
  warning: 'border-amber-100 bg-amber-50/50',
  neutral: 'border-slate-100 bg-white',
}

export interface TravelInsightCardProps {
  insight: TravelInsight
  locale: ItineraryLocale
}

export function TravelInsightCard({ insight, locale }: TravelInsightCardProps) {
  return (
    <article
      className={`rounded-2xl border p-4 shadow-sm ${TONE[insight.tone]}`}
      data-testid={`travel-insight-${insight.kind}`}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-bold text-slate-900">
          {locale === 'ar' ? insight.titleAr : insight.titleEn}
        </h3>
        {insight.architectureReady ? (
          <span className="rounded-md bg-white/80 px-1.5 py-0.5 text-[9px] font-semibold text-slate-500">
            {locale === 'ar' ? 'جاهز معمارياً' : 'Arch-ready'}
          </span>
        ) : null}
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
        {locale === 'ar' ? insight.bodyAr : insight.bodyEn}
      </p>
    </article>
  )
}

export interface TravelInsightsPanelProps {
  insights: TravelInsight[]
  locale: ItineraryLocale
  title: string
}

export function TravelInsightsPanel({ insights, locale, title }: TravelInsightsPanelProps) {
  return (
    <section data-testid="travel-insights">
      <h2 className="mb-3 text-sm font-bold text-slate-900">{title}</h2>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {insights.map((insight) => (
          <TravelInsightCard key={insight.id} insight={insight} locale={locale} />
        ))}
      </div>
    </section>
  )
}
