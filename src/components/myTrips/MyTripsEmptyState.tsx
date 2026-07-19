export interface MyTripsEmptyStateProps {
  locale?: 'ar' | 'en'
  onStart: () => void
}

export function MyTripsEmptyState({ locale = 'ar', onStart }: MyTripsEmptyStateProps) {
  const t = (ar: string, en: string) => (locale === 'ar' ? ar : en)
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 py-12 text-center">
      <p className="text-sm font-bold text-slate-700">
        {t('لا توجد رحلات في هذا القسم بعد', 'No trips in this section yet')}
      </p>
      <p className="mt-1 text-xs text-slate-500">
        {t('ابدأ بحثاً واختر رحلة لحفظها هنا', 'Start a search and select a flight to see it here')}
      </p>
      <button
        type="button"
        onClick={onStart}
        className="mt-4 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-primary-700"
      >
        {t('ابدأ التخطيط لرحلة', 'Plan a trip')}
      </button>
    </div>
  )
}
