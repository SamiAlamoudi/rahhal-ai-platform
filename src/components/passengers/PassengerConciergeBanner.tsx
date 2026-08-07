import type { PassengerConciergeSummary } from '../../lib/passengers'

export interface PassengerConciergeBannerProps {
  summary: PassengerConciergeSummary
}

export function PassengerConciergeBanner({ summary }: PassengerConciergeBannerProps) {
  return (
    <section className="rounded-2xl border border-sky-100 bg-gradient-to-l from-sky-50 via-white to-amber-50 p-4 shadow-sm">
      <p className="text-[10px] font-bold uppercase tracking-wide text-sky-700/80">
        {summary.locale === 'ar' ? 'مستشار بيلامو' : 'Bilamo concierge'}
      </p>
      <div className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-800">
        {summary.summaryText}
      </div>
    </section>
  )
}
