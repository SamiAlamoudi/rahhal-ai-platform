import type { TripSummary, ItineraryLocale } from '../../lib/smartItinerary'

export interface TripSummaryCardProps {
  summary: TripSummary
  locale: ItineraryLocale
}

export function TripSummaryCard({ summary, locale }: TripSummaryCardProps) {
  const t = (ar: string, en: string) => (locale === 'ar' ? ar : en)

  return (
    <section
      className="rounded-2xl border border-primary-100 bg-gradient-to-l from-primary-50/50 via-white to-sky-50/40 p-5 shadow-sm"
      data-testid="trip-summary"
    >
      <p className="font-mono text-[10px] font-bold uppercase tracking-wide text-slate-400">
        {summary.bookingReference}
      </p>
      <h1 className="mt-1 text-lg font-bold text-slate-900 sm:text-xl">
        {locale === 'ar' ? summary.titleAr : summary.titleEn}
      </h1>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-700 sm:grid-cols-3">
        <div>
          <dt className="text-slate-400">{t('الخطوط', 'Airline')}</dt>
          <dd className="font-semibold">{summary.airline}</dd>
        </div>
        <div>
          <dt className="text-slate-400">{t('المدة', 'Duration')}</dt>
          <dd className="font-semibold">
            {summary.durationDays} {t('أيام', 'days')}
          </dd>
        </div>
        <div>
          <dt className="text-slate-400">{t('المسافرون', 'Passengers')}</dt>
          <dd className="font-semibold">{summary.passengerCount}</dd>
        </div>
        {summary.orderNumber ? (
          <div>
            <dt className="text-slate-400">{t('الطلب', 'Order')}</dt>
            <dd className="font-semibold font-mono text-[11px]">{summary.orderNumber}</dd>
          </div>
        ) : null}
      </dl>
    </section>
  )
}
