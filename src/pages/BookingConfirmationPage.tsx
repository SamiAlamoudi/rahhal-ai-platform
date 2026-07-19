import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  confirmationStateFromSession,
  startConfirmation,
  retryConfirmation,
  buildConfirmationScreenSummary,
  type ConfirmationState,
} from '../lib/bookingConfirmation'
import {
  resolveBookingSessionForUser,
  toBookingRecord,
  type BookingRecord,
} from '../lib/booking'
import { getFeatureRegistry } from '../lib/ai'
import { useAuth } from '../lib/auth'
import {
  BookingTimeline,
  ConfirmationStatusBadge,
} from '../components/bookingConfirmation'

export default function BookingConfirmationPage() {
  const { sessionId: routeSessionId = '' } = useParams<{ sessionId: string }>()
  const [searchParams] = useSearchParams()
  const sessionId = routeSessionId || searchParams.get('session') || ''
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const enabled = getFeatureRegistry().isEnabled('ui.booking_confirmation')
  const timelineEnabled = getFeatureRegistry().isEnabled('ui.booking_timeline')
  const [locale] = useState<'ar' | 'en'>('en')

  const [record, setRecord] = useState<BookingRecord | null>(null)
  const [state, setState] = useState<ConfirmationState | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const runConfirm = useCallback(async (mode: 'start' | 'retry') => {
    if (!user?.id || !sessionId) return
    setBusy(true)
    setError(null)
    try {
      const result = mode === 'retry'
        ? await retryConfirmation({ sessionId, userId: user.id, locale })
        : await startConfirmation({ sessionId, userId: user.id, locale })
      setState(result.state)
      if (!result.ok && result.error) setError(result.error)
      const session = await resolveBookingSessionForUser(sessionId, user.id)
      if (session) setRecord(toBookingRecord(session))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Confirmation failed')
    } finally {
      setBusy(false)
    }
  }, [user?.id, sessionId, locale])

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
        if (!session) {
          setError('Booking not found')
          return
        }
        setRecord(toBookingRecord(session))
        const existing = confirmationStateFromSession(session)
        setState(existing)
        if (existing.status === 'pending' || existing.status === 'failed') {
          // Auto-start confirmation when landing on the page
          const result = existing.status === 'failed'
            ? await retryConfirmation({ sessionId, userId: user.id, locale })
            : await startConfirmation({ sessionId, userId: user.id, locale })
          if (!cancelled) {
            setState(result.state)
            if (!result.ok && result.error) setError(result.error)
            const refreshed = await resolveBookingSessionForUser(sessionId, user.id)
            if (refreshed) setRecord(toBookingRecord(refreshed))
          }
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load confirmation')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [enabled, authLoading, user?.id, sessionId, locale])

  const conciergeText = useMemo(
    () => (state ? buildConfirmationScreenSummary(state, locale) : ''),
    [state, locale],
  )

  if (!enabled) return <Navigate to="/my-trips" replace />
  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
        <p className="text-xs text-slate-400">Confirming booking…</p>
      </div>
    )
  }
  if (!user?.id) return <Navigate to="/login" replace />
  if (!sessionId || !state) {
    return <Navigate to="/my-trips" replace />
  }

  const t = (ar: string, en: string) => (locale === 'ar' ? ar : en)
  const status = state.status

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-emerald-50/30">
      <header className="sticky top-0 z-20 border-b border-slate-100 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-wide text-slate-400">
              {state.confirmationReference}
            </p>
            <h1 className="text-base font-bold text-slate-900">
              {t('تأكيد الحجز', 'Booking confirmation')}
            </h1>
          </div>
          <ConfirmationStatusBadge status={status} locale={locale} />
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-4 py-6">
        {status === 'confirming' && (
          <div className="flex items-center gap-3 rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-800">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-sky-200 border-t-sky-600" />
            {t('جاري التأكيد مع المزوّد…', 'Confirming with supplier…')}
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        <section className="rounded-2xl border border-sky-100 bg-gradient-to-l from-sky-50 via-white to-amber-50 p-4 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wide text-sky-700/80">
            {t('مستشار رحّال', 'Rahhal concierge')}
          </p>
          <div className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-800">
            {conciergeText}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900">{t('مرجع التأكيد', 'Confirmation reference')}</h2>
          <p className="mt-2 font-mono text-lg font-bold text-slate-900">{state.confirmationReference}</p>
          <p className="mt-1 text-xs text-slate-500">
            {t('مرجع المزوّد', 'Supplier reference')}:{' '}
            {state.supplierReference || t('بانتظار', 'Pending')}
          </p>
        </section>

        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900">{t('ملخص الرحلة', 'Flight summary')}</h2>
          {record?.flight ? (
            <p className="mt-2 text-sm text-slate-700">
              {record.flight.airline} · {record.flight.origin} → {record.flight.destination}
            </p>
          ) : (
            <p className="mt-2 text-xs text-slate-500">{record?.itemTitles.join(' · ') || '—'}</p>
          )}
        </section>

        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900">{t('المسافرون', 'Passengers')}</h2>
          {record && record.passengers.length > 0 ? (
            <ul className="mt-2 space-y-1 text-xs text-slate-700">
              {record.passengers.map((p) => (
                <li key={p.id}>{p.firstName} {p.lastName} ({p.type})</li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-slate-500">{t('لا توجد بيانات', 'No passenger data')}</p>
          )}
        </section>

        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900">{t('السعر', 'Fare summary')}</h2>
          {record ? (
            <dl className="mt-2 space-y-1 text-xs text-slate-700">
              <div className="flex justify-between">
                <dt>{t('الأجرة', 'Fare')}</dt>
                <dd>{record.fare.fare.toLocaleString()} {record.fare.currency}</dd>
              </div>
              <div className="flex justify-between">
                <dt>{t('الضرائب', 'Taxes')}</dt>
                <dd>{record.fare.taxes.toLocaleString()} {record.fare.currency}</dd>
              </div>
              <div className="flex justify-between font-bold">
                <dt>{t('الإجمالي', 'Total')}</dt>
                <dd>{record.fare.grandTotal.toLocaleString()} {record.fare.currency}</dd>
              </div>
            </dl>
          ) : null}
        </section>

        {timelineEnabled && (
          <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold text-slate-900">{t('الخط الزمني', 'Timeline')}</h2>
            <div className="mt-3">
              <BookingTimeline
                events={state.events}
                locale={locale}
                activeType={
                  status === 'confirmed'
                    ? 'supplier_confirmed'
                    : status === 'failed'
                      ? 'confirmation_failed'
                      : status === 'confirming'
                        ? 'confirming'
                        : 'waiting_for_supplier'
                }
              />
            </div>
          </section>
        )}

        <div className="flex flex-wrap gap-2 pt-2">
          {(status === 'failed' || status === 'pending') && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void runConfirm(status === 'failed' ? 'retry' : 'start')}
              className="rounded-xl bg-primary-600 px-4 py-2 text-xs font-bold text-white hover:bg-primary-700 disabled:opacity-60"
            >
              {busy
                ? t('جاري…', 'Working…')
                : status === 'failed'
                  ? t('إعادة المحاولة', 'Retry')
                  : t('تأكيد الحجز', 'Confirm booking')}
            </button>
          )}
          <Link
            to={`/my-trips/${encodeURIComponent(sessionId)}`}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            {t('تفاصيل الحجز', 'Booking details')}
          </Link>
          <button
            type="button"
            onClick={() => navigate('/my-trips')}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            {t('رحلاتي', 'My Trips')}
          </button>
        </div>
      </main>
    </div>
  )
}
