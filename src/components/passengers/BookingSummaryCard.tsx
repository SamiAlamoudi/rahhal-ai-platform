import type {
  FareBreakdown,
  Passenger,
  SelectedFlightSummary,
} from '../../lib/passengers'

export interface BookingSummaryCardProps {
  flight: SelectedFlightSummary | null
  passengers: Passenger[]
  fare: FareBreakdown
  sessionId: string
  locale?: 'ar' | 'en'
}

function formatTime(iso: string): string {
  if (!iso) return '—'
  const d = Date.parse(iso)
  if (!Number.isFinite(d)) return iso
  return new Date(d).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function BookingSummaryCard({
  flight,
  passengers,
  fare,
  sessionId,
  locale = 'en',
}: BookingSummaryCardProps) {
  const t = (ar: string, en: string) => (locale === 'ar' ? ar : en)

  return (
    <aside className="space-y-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div>
        <h2 className="text-sm font-bold text-slate-900">{t('ملخص الحجز', 'Booking summary')}</h2>
        <p className="mt-1 text-[10px] font-medium text-slate-400">
          {t('معرّف الجلسة', 'Session')}: {sessionId.slice(0, 8)}…
        </p>
      </div>

      <section>
        <h3 className="text-xs font-bold text-slate-500">{t('الرحلة المختارة', 'Selected flight')}</h3>
        {flight ? (
          <div className="mt-2 space-y-1 text-sm text-slate-800">
            <p className="font-bold">{flight.airline || flight.title}</p>
            <p>
              {flight.origin || '—'} → {flight.destination || '—'}
            </p>
            <p className="text-xs text-slate-500">
              {formatTime(flight.departureTime)} – {formatTime(flight.arrivalTime)}
            </p>
            {flight.cabin && (
              <p className="text-xs capitalize text-slate-500">
                {t('الدرجة', 'Cabin')}: {flight.cabin}
              </p>
            )}
          </div>
        ) : (
          <p className="mt-2 text-xs text-slate-500">{t('لا توجد رحلة', 'No flight selected')}</p>
        )}
      </section>

      <section>
        <h3 className="text-xs font-bold text-slate-500">{t('المسافرون', 'Passengers')}</h3>
        {passengers.length === 0 ? (
          <p className="mt-2 text-xs text-slate-500">{t('لم تُضف بيانات بعد', 'No passenger details yet')}</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {passengers.map((p, i) => (
              <li key={p.id} className="text-xs text-slate-700">
                <span className="font-semibold">{i + 1}. </span>
                {p.firstName || p.lastName
                  ? `${p.firstName} ${p.lastName}`.trim()
                  : t(`مسافر ${p.type}`, `${p.type} passenger`)}
                <span className="ms-1 text-slate-400">({p.type})</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="border-t border-slate-100 pt-3">
        <h3 className="text-xs font-bold text-slate-500">{t('تفاصيل السعر', 'Fare breakdown')}</h3>
        <dl className="mt-2 space-y-1.5 text-xs text-slate-700">
          <div className="flex justify-between">
            <dt>{t('الأجرة', 'Fare')}</dt>
            <dd>{fare.fare.toLocaleString()} {fare.currency}</dd>
          </div>
          <div className="flex justify-between">
            <dt>{t('الضرائب', 'Taxes')}</dt>
            <dd>{fare.taxes.toLocaleString()} {fare.currency}</dd>
          </div>
          <div className="flex justify-between">
            <dt>{t('الرسوم', 'Fees')}</dt>
            <dd>{fare.fees.toLocaleString()} {fare.currency}</dd>
          </div>
          <div className="flex justify-between border-t border-slate-100 pt-2 text-sm font-bold text-slate-900">
            <dt>{t('الإجمالي', 'Grand total')}</dt>
            <dd>{fare.grandTotal.toLocaleString()} {fare.currency}</dd>
          </div>
        </dl>
      </section>
    </aside>
  )
}
