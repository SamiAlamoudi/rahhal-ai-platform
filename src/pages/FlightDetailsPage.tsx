import { useMemo } from 'react'
import { Link, useLocation, useNavigate, Navigate } from 'react-router-dom'
import type { NormalizedTravelOption } from '../utils/searchOrchestrator'
import type { TravelSearchRequest } from '../utils/travelSearchRequest'
import {
  formatFlightDuration,
  formatFlightTime,
  stopsLabel,
  toFlightResultViewModel,
} from '../lib/flightResults'

interface LocationState {
  option: NormalizedTravelOption
  searchRequest: TravelSearchRequest
  travelSessionId?: string | null
  locale?: 'ar' | 'en'
}

function layoverMinutes(prevArrival: string, nextDeparture: string): number | null {
  const a = Date.parse(prevArrival)
  const b = Date.parse(nextDeparture)
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return null
  return Math.round((b - a) / 60000)
}

export default function FlightDetailsPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const state = location.state as LocationState | null
  const option = state?.option && state.option.type === 'flight' ? state.option : null
  const locale = state?.locale ?? 'en'
  const view = useMemo(
    () => (option ? toFlightResultViewModel(option) : null),
    [option],
  )
  const t = (ar: string, en: string) => (locale === 'ar' ? ar : en)

  if (!state?.option || !option || !view) {
    return <Navigate to="/search" replace />
  }

  return (
    <div className="mx-auto min-h-screen max-w-3xl bg-slate-50 px-4 py-6">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="mb-4 text-xs font-bold text-slate-600 hover:text-slate-900"
      >
        {t('← رجوع للنتائج', '← Back to results')}
      </button>

      <header className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <p className="text-xs font-bold text-slate-500">{view.airlineName}</p>
        <h1 className="mt-1 text-xl font-bold text-slate-900">
          {view.origin} → {view.destination}
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          {formatFlightTime(view.departureTime)} – {formatFlightTime(view.arrivalTime)}
          {' · '}
          {formatFlightDuration(view.durationMinutes)}
          {' · '}
          {stopsLabel(view.stops, locale)}
        </p>
        <p className="mt-3 text-lg font-bold text-primary-600">
          {view.price.toLocaleString()} {view.currency}
        </p>
      </header>

      <section className="mt-4 space-y-3">
        <h2 className="text-sm font-bold text-slate-800">{t('القطاعات', 'Segments')}</h2>
        {view.segments.length === 0 && (
          <p className="rounded-xl bg-white p-4 text-sm text-slate-500">
            {t('تفاصيل القطاعات غير متاحة لهذا العرض.', 'Segment details are unavailable for this offer.')}
          </p>
        )}
        {view.segments.map((segment, index) => {
          const next = view.segments[index + 1]
          const layover = next
            ? layoverMinutes(segment.arrival, next.departure)
            : null
          return (
            <div key={`${segment.flightNumber}-${index}`} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <p className="text-xs font-bold text-slate-500">
                {t('القطاع', 'Segment')} {index + 1}
              </p>
              <p className="mt-1 text-sm font-bold text-slate-900">
                {segment.origin} → {segment.destination}
              </p>
              <dl className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
                <div>
                  <dt className="font-semibold text-slate-400">{t('المغادرة', 'Departure')}</dt>
                  <dd>{formatFlightTime(segment.departure)} · {segment.origin}
                    {segment.departureTerminal ? ` · T${segment.departureTerminal}` : ''}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-400">{t('الوصول', 'Arrival')}</dt>
                  <dd>{formatFlightTime(segment.arrival)} · {segment.destination}
                    {segment.arrivalTerminal ? ` · T${segment.arrivalTerminal}` : ''}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-400">{t('رقم الرحلة', 'Flight number')}</dt>
                  <dd>{segment.flightNumber}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-400">{t('الناقل التشغيلي', 'Operating carrier')}</dt>
                  <dd>{segment.operatingCarrier || segment.carrier}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-400">{t('الطائرة', 'Aircraft')}</dt>
                  <dd>{segment.aircraft || view.aircraft || '—'}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-400">{t('المدة', 'Duration')}</dt>
                  <dd>{formatFlightDuration(segment.durationMinutes)}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-400">{t('عائلة السعر', 'Fare family')}</dt>
                  <dd>{segment.fareFamily || view.fareFamily || '—'}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-400">{t('درجة الحجز', 'Booking class')}</dt>
                  <dd>{segment.bookingClass || view.bookingClass || segment.cabin}</dd>
                </div>
              </dl>
              {layover != null && (
                <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-800">
                  {t('توقف', 'Layover')}: {formatFlightDuration(layover)}
                  {' '}
                  {t('في', 'in')} {segment.destination}
                </p>
              )}
            </div>
          )
        })}
      </section>

      <section className="mt-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-bold text-slate-800">{t('السياسات والأمتعة', 'Policies & baggage')}</h2>
        <dl className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
          <div>
            <dt className="font-semibold text-slate-400">{t('الأمتعة', 'Baggage')}</dt>
            <dd>
              {view.baggageIncluded == null
                ? '—'
                : view.baggageIncluded
                  ? t('مشمولة', 'Included')
                  : t('غير مشمولة / غير مؤكدة', 'Not included / unconfirmed')}
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-400">{t('الاسترداد', 'Refundability')}</dt>
            <dd>
              {view.refundable == null
                ? t('غير متاح', 'Not available')
                : view.refundable
                  ? t('قابل للاسترداد', 'Refundable')
                  : t('غير قابل للاسترداد', 'Non-refundable')}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="font-semibold text-slate-400">{t('سياسة التغيير / الإلغاء', 'Change / cancellation policy')}</dt>
            <dd>{view.cancellationPolicy || t('غير متاحة من المزوّد', 'Not provided by supplier')}</dd>
          </div>
        </dl>
      </section>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          to="/results"
          state={{
            rankedOptions: [state.option],
            reasoningResults: new Map(),
            searchRequest: state.searchRequest,
            travelSessionId: state.travelSessionId ?? null,
          }}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700"
        >
          {t('عودة', 'Back')}
        </Link>
      </div>
    </div>
  )
}
