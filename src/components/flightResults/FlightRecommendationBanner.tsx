import type { FlightRecommendationSummary } from '../../lib/flightResults'

export interface FlightRecommendationBannerProps {
  summary: FlightRecommendationSummary
}

export function FlightRecommendationBanner({ summary }: FlightRecommendationBannerProps) {
  return (
    <section className="rounded-2xl border border-amber-100 bg-gradient-to-l from-amber-50 via-white to-sky-50 p-4 shadow-sm">
      <p className="text-[10px] font-bold uppercase tracking-wide text-amber-700/80">
        {summary.locale === 'ar' ? 'توصية المستشار' : 'Concierge recommendation'}
      </p>
      <div className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-800">
        {summary.summaryText}
      </div>
      {summary.totalFlights > 0 && (
        <p className="mt-2 text-[11px] font-medium text-slate-500">
          {summary.locale === 'ar'
            ? `${summary.totalFlights} خياراً متاحاً`
            : `${summary.totalFlights} options available`}
        </p>
      )}
    </section>
  )
}
