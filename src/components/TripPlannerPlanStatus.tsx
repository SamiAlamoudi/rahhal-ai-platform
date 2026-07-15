/**
 * Phase AH — status blocks for Trip Planner API integration.
 * Reuses existing loading/error card styles; no layout redesign.
 */

import type { BookingPreview, PipelineConfidence } from '../lib/ai/tripPlanner/models'

interface Props {
  loading: boolean
  error: string | null
  pipelineLabels: string[]
  pipelineStage: string | null
  confidence: PipelineConfidence | null
  warnings: string[]
  assumptions: string[]
  tradeOffs: string[]
  validationErrors: string[]
  partial: boolean
  bookingPreview: BookingPreview | null
  onRetry: () => void
  onCancel: () => void
  locale?: 'ar' | 'en'
}

export default function TripPlannerPlanStatus({
  loading,
  error,
  pipelineLabels,
  pipelineStage,
  confidence,
  warnings,
  assumptions,
  tradeOffs,
  validationErrors,
  partial,
  bookingPreview,
  onRetry,
  onCancel,
  locale = 'ar',
}: Props) {
  const ar = locale === 'ar'

  return (
    <div className="space-y-4">
      {loading && (
        <div className="flex items-center justify-center py-12" aria-label={ar ? 'جاري التخطيط' : 'Planning'} aria-busy="true">
          <div className="flex flex-col items-center gap-3">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
            <p className="text-sm text-slate-500">
              {ar ? 'رحّال يفكر في أفضل خياراتك...' : 'Rahhal is planning your trip...'}
            </p>
            {pipelineStage && (
              <p className="text-xs font-medium text-primary-600" aria-live="polite">
                {pipelineLabels[pipelineLabels.length - 1] ?? pipelineStage}
              </p>
            )}
            {pipelineLabels.length > 0 && (
              <ol className="mt-1 max-w-sm list-decimal space-y-0.5 px-6 text-left text-xs text-slate-400">
                {pipelineLabels.slice(-5).map((label) => (
                  <li key={label}>{label}</li>
                ))}
              </ol>
            )}
            <button
              type="button"
              onClick={onCancel}
              className="mt-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50"
            >
              {ar ? 'إلغاء' : 'Cancel'}
            </button>
          </div>
        </div>
      )}

      {!loading && error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-center" role="alert">
          <p className="text-sm font-bold text-rose-600">{error}</p>
          {validationErrors.length > 1 && (
            <ul className="mt-2 space-y-1 text-xs text-rose-500">
              {validationErrors.slice(1).map((msg) => (
                <li key={msg}>{msg}</li>
              ))}
            </ul>
          )}
          <div className="mt-3 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={onRetry}
              className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-rose-700"
            >
              {ar ? 'إعادة المحاولة' : 'Retry'}
            </button>
          </div>
        </div>
      )}

      {!loading && !error && partial && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3 text-center">
          <p className="text-sm font-bold text-amber-700">
            {ar ? 'نتائج جزئية متاحة — بعض الخطوات لم تكتمل.' : 'Partial results available — some stages did not complete.'}
          </p>
        </div>
      )}

      {!loading && confidence && (
        <div className="rounded-2xl border border-slate-100 bg-white px-5 py-4 shadow-sm">
          <p className="text-sm font-bold text-slate-900">
            {ar ? 'ثقة التخطيط' : 'Planning confidence'}{' '}
            <span className="text-primary-600">{Math.round(confidence.overall * 100)}%</span>
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {ar ? 'توصيات' : 'Recommendations'} {Math.round(confidence.recommendation * 100)}%
            {' · '}
            {ar ? 'خط السير' : 'Itinerary'} {Math.round(confidence.itinerary * 100)}%
            {' · '}
            {ar ? 'اكتمال البيانات' : 'Completeness'} {Math.round(confidence.dataCompleteness * 100)}%
          </p>
          {confidence.notes.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-slate-500">
              {confidence.notes.slice(0, 3).map((n) => (
                <li key={n}>• {n}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {!loading && (assumptions.length > 0 || tradeOffs.length > 0 || warnings.length > 0) && (
        <div className="rounded-2xl border border-slate-100 bg-white px-5 py-4 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900">
            {ar ? 'شرح الخطة' : 'Plan explanation'}
          </h3>
          {assumptions.length > 0 && (
            <div className="mt-2">
              <p className="text-xs font-semibold text-slate-600">{ar ? 'افتراضات' : 'Assumptions'}</p>
              <ul className="mt-1 space-y-1 text-xs text-slate-500">
                {assumptions.slice(0, 4).map((a) => (
                  <li key={a}>• {a}</li>
                ))}
              </ul>
            </div>
          )}
          {tradeOffs.length > 0 && (
            <div className="mt-2">
              <p className="text-xs font-semibold text-slate-600">{ar ? 'مقايضات' : 'Trade-offs'}</p>
              <ul className="mt-1 space-y-1 text-xs text-slate-500">
                {tradeOffs.slice(0, 4).map((t) => (
                  <li key={t}>• {t}</li>
                ))}
              </ul>
            </div>
          )}
          {warnings.length > 0 && (
            <div className="mt-2">
              <p className="text-xs font-semibold text-amber-700">{ar ? 'تنبيهات' : 'Warnings'}</p>
              <ul className="mt-1 space-y-1 text-xs text-amber-700/80">
                {warnings.slice(0, 4).map((w) => (
                  <li key={w}>• {w}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {!loading && bookingPreview && (
        <div className="rounded-2xl border border-primary-100 bg-primary-50/40 px-5 py-4">
          <p className="text-sm font-bold text-primary-800">
            {ar ? 'معاينة الحجز (تجريبية)' : 'Booking preview (mock)'}
          </p>
          <p className="mt-1 text-xs text-primary-700">
            {ar ? 'الحالة' : 'State'}: {bookingPreview.state}
            {' · '}
            {ar ? 'جاهزية الحجز' : 'Reservation ready'}:{' '}
            {bookingPreview.reservationReady ? (ar ? 'نعم' : 'yes') : (ar ? 'لا' : 'no')}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {ar
              ? 'لا يتم تنفيذ دفع أو تأكيد حقيقي — المعاينة فقط.'
              : 'No real payment or confirmation — preview only.'}
          </p>
          <p className="mt-1 text-xs text-slate-600">
            {ar ? 'الإجمالي التقديري' : 'Estimated total'}: {bookingPreview.summary.total}{' '}
            {bookingPreview.summary.currency}
          </p>
        </div>
      )}
    </div>
  )
}
