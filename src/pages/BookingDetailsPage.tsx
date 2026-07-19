import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import {
  buildBookingDetailsConciergeSummary,
  loadUserBookingRecords,
  resolveBookingSessionForUser,
  toBookingRecord,
  type BookingRecord,
} from '../lib/booking'
import { getFeatureRegistry } from '../lib/ai'
import { useAuth } from '../lib/auth'
import { MyTripsErrorState, MyTripsLoadingState } from '../components/myTrips'

export default function BookingDetailsPage() {
  const { sessionId = '' } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const enabled = getFeatureRegistry().isEnabled('ui.booking_history')
  const confirmationEnabled = getFeatureRegistry().isEnabled('ui.booking_confirmation')
  const [locale] = useState<'ar' | 'en'>('en')

  const [record, setRecord] = useState<BookingRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled || authLoading) return
    if (!user?.id || !sessionId) {
      setLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const session = await resolveBookingSessionForUser(sessionId, user.id)
        if (cancelled) return
        if (session) {
          setRecord(toBookingRecord(session))
          return
        }
        const all = await loadUserBookingRecords(user.id)
        const found = all.find((r) => r.sessionId === sessionId) ?? null
        if (!found) setError(locale === 'ar' ? 'الحجز غير موجود' : 'Booking not found')
        setRecord(found)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load booking')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [enabled, authLoading, user?.id, sessionId, locale])

  const conciergeText = useMemo(
    () => (record ? buildBookingDetailsConciergeSummary(record, locale) : ''),
    [record, locale],
  )

  if (!enabled) return <Navigate to="/my-trips" replace />

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <MyTripsLoadingState />
      </div>
    )
  }

  if (!user?.id) return <Navigate to="/login" replace />

  if (error || !record) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <MyTripsErrorState
          message={error || 'Booking not found'}
          locale={locale}
          onRetry={() => navigate('/my-trips')}
        />
      </div>
    )
  }

  const t = (ar: string, en: string) => (locale === 'ar' ? ar : en)

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-sky-50/40">
      <header className="sticky top-0 z-20 border-b border-slate-100 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
              {record.bookingReference}
            </p>
            <h1 className="text-base font-bold text-slate-900">{t('تفاصيل الحجز', 'Booking details')}</h1>
          </div>
          <Link
            to="/my-trips"
            className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
          >
            {t('رحلاتي', 'My Trips')}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-4 py-6">
        <section className="rounded-2xl border border-sky-100 bg-gradient-to-l from-sky-50 via-white to-amber-50 p-4 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wide text-sky-700/80">
            {t('مستشار رحّال', 'Rahhal concierge')}
          </p>
          <div className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-800">
            {conciergeText}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900">{t('معلومات الرحلة', 'Flight information')}</h2>
          {record.flight ? (
            <dl className="mt-3 grid gap-2 text-xs text-slate-700 sm:grid-cols-2">
              <div>
                <dt className="font-semibold text-slate-400">{t('الناقل', 'Airline')}</dt>
                <dd>{record.flight.airline || '—'}</dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-400">{t('المسار', 'Route')}</dt>
                <dd>{record.flight.origin} → {record.flight.destination}</dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-400">{t('المغادرة', 'Departure')}</dt>
                <dd>{record.flight.departureTime || '—'}</dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-400">{t('الوصول', 'Arrival')}</dt>
                <dd>{record.flight.arrivalTime || '—'}</dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-400">{t('الدرجة', 'Cabin')}</dt>
                <dd className="capitalize">{record.flight.cabin || '—'}</dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-400">{t('الحالة', 'Status')}</dt>
                <dd>{record.status}</dd>
              </div>
            </dl>
          ) : (
            <p className="mt-2 text-xs text-slate-500">{record.itemTitles.join(' · ') || '—'}</p>
          )}
        </section>

        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900">{t('المسافرون', 'Passengers')}</h2>
          {record.passengers.length === 0 ? (
            <p className="mt-2 text-xs text-slate-500">
              {t('لم تُحفظ بيانات المسافرين بعد', 'Passenger details not saved yet')}
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {record.passengers.map((p, i) => (
                <li key={p.id} className="text-xs text-slate-700">
                  <span className="font-semibold">{i + 1}. </span>
                  {p.firstName} {p.lastName}
                  <span className="ms-1 text-slate-400">({p.type})</span>
                  {p.nationality ? <span className="ms-1 text-slate-400">· {p.nationality}</span> : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900">{t('تفاصيل السعر', 'Fare breakdown')}</h2>
          <dl className="mt-3 space-y-1.5 text-xs text-slate-700">
            <div className="flex justify-between">
              <dt>{t('الأجرة', 'Fare')}</dt>
              <dd>{record.fare.fare.toLocaleString()} {record.fare.currency}</dd>
            </div>
            <div className="flex justify-between">
              <dt>{t('الضرائب', 'Taxes')}</dt>
              <dd>{record.fare.taxes.toLocaleString()} {record.fare.currency}</dd>
            </div>
            <div className="flex justify-between">
              <dt>{t('الرسوم', 'Fees')}</dt>
              <dd>{record.fare.fees.toLocaleString()} {record.fare.currency}</dd>
            </div>
            <div className="flex justify-between border-t border-slate-100 pt-2 text-sm font-bold">
              <dt>{t('الإجمالي', 'Grand total')}</dt>
              <dd>{record.fare.grandTotal.toLocaleString()} {record.fare.currency}</dd>
            </div>
          </dl>
        </section>

        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900">{t('المرجع والحالة', 'Reference & status')}</h2>
          <dl className="mt-3 grid gap-2 text-xs text-slate-700 sm:grid-cols-2">
            <div>
              <dt className="font-semibold text-slate-400">{t('مرجع رحّال', 'Rahhal reference')}</dt>
              <dd className="font-mono">{record.bookingReference}</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-400">{t('مرجع المزوّد', 'Provider reference')}</dt>
              <dd>{record.providerBookingReference || t('بانتظار التأكيد', 'Pending confirmation')}</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-400">{t('الحالة', 'Status')}</dt>
              <dd>{record.status}</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-400">{t('التصنيف', 'Bucket')}</dt>
              <dd>{record.bucket}</dd>
            </div>
          </dl>
        </section>

        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900">{t('الخط الزمني', 'Timeline')}</h2>
          <ol className="mt-3 space-y-3 border-s-2 border-slate-100 ps-4">
            {record.timeline.map((event) => (
              <li key={event.id} className="relative text-xs text-slate-700">
                <span className="absolute -start-[1.35rem] top-1 h-2.5 w-2.5 rounded-full bg-primary-500" />
                <p className="font-semibold">
                  {locale === 'ar' ? event.labelAr : event.labelEn}
                </p>
                <p className="text-[11px] text-slate-400">
                  {new Date(event.at).toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US')}
                </p>
              </li>
            ))}
          </ol>
        </section>

        {confirmationEnabled && (
          <Link
            to={`/booking/confirmation/${encodeURIComponent(record.sessionId)}`}
            className="inline-flex rounded-xl bg-primary-600 px-4 py-2 text-xs font-bold text-white hover:bg-primary-700"
          >
            {t('فتح شاشة التأكيد', 'Open confirmation')}
          </Link>
        )}
      </main>
    </div>
  )
}
