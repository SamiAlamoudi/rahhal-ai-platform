import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { getFeatureRegistry } from '../lib/ai'
import { useAuth } from '../lib/auth'
import { confirmationStateFromSession } from '../lib/bookingConfirmation'
import { getBookingOrchestrator } from '../lib/booking'
import {
  buildCheckoutReviewModel,
  buildOrderTimeline,
  activeOrderTimelineType,
  createPaymentSessionForOrder,
  getManagedOrder,
  type ManagedOrder,
} from '../lib/orderManagement'
import { BookingTimeline } from '../components/bookingConfirmation'

export default function OrderCheckoutReviewPage() {
  const { orderId = '' } = useParams<{ orderId: string }>()
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const reviewEnabled = getFeatureRegistry().isEnabled('ui.checkout_review')
  const paymentEnabled = getFeatureRegistry().isEnabled('ui.payment_preparation')
  const timelineEnabled = getFeatureRegistry().isEnabled('ui.booking_timeline')
  const [locale] = useState<'ar' | 'en'>('en')
  const [order, setOrder] = useState<ManagedOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [acceptedTerms, setAcceptedTerms] = useState(false)

  useEffect(() => {
    if (!reviewEnabled || authLoading) return
    if (!user?.id || !orderId) {
      setLoading(false)
      return
    }
    const found = getManagedOrder(orderId)
    if (found && found.customerId === user.id) {
      setOrder(found)
    } else {
      setError('Order not found')
    }
    setLoading(false)
  }, [reviewEnabled, authLoading, user?.id, orderId])

  const model = useMemo(() => (order ? buildCheckoutReviewModel(order) : null), [order])

  const timelineEvents = useMemo(() => {
    if (!order) return []
    const session = order.bookingSessionId
      ? getBookingOrchestrator().getBookingSession(order.bookingSessionId)
      : null
    const confirmation = session ? confirmationStateFromSession(session) : null
    return buildOrderTimeline({ order, confirmation })
  }, [order])

  const handlePay = useCallback(async () => {
    if (!user?.id || !order) return
    if (!acceptedTerms) {
      setError(locale === 'ar' ? 'يرجى الموافقة على الشروط' : 'Please accept the booking conditions')
      return
    }
    if (!paymentEnabled) {
      setError('Payment preparation is disabled')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const result = await createPaymentSessionForOrder({
        orderId: order.orderId,
        userId: user.id,
        returnUrl: '/checkout/return',
      })
      if (!result.ok || !result.session) {
        setError(result.error ?? 'Could not create payment session')
        return
      }
      const refreshed = getManagedOrder(order.orderId)
      if (refreshed) setOrder(refreshed)
      if (result.session.redirectUrl) {
        navigate(result.session.redirectUrl, { replace: false })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment session failed')
    } finally {
      setBusy(false)
    }
  }, [user?.id, order, acceptedTerms, paymentEnabled, locale, navigate])

  if (!reviewEnabled) return <Navigate to="/my-trips" replace />
  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
        <p className="text-xs text-slate-400">Loading checkout…</p>
      </div>
    )
  }
  if (!user?.id) return <Navigate to="/login" replace />
  if (!order || !model) {
    return <Navigate to="/my-trips" replace />
  }

  const t = (ar: string, en: string) => (locale === 'ar' ? ar : en)

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-amber-50/20" data-testid="order-checkout-review">
      <header className="sticky top-0 z-20 border-b border-slate-100 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-wide text-slate-400">
              {model.orderNumber}
            </p>
            <h1 className="text-base font-bold text-slate-900">
              {t('مراجعة الدفع', 'Checkout review')}
            </h1>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-medium text-slate-600">
            {model.orderStatusLabel}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-4 py-6">
        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        <section className="rounded-2xl border border-sky-100 bg-gradient-to-l from-sky-50 via-white to-amber-50 p-4 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wide text-sky-700/80">
            {t('مستشار بيلامو', 'AI Concierge summary')}
          </p>
          <div className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-800">
            {model.conciergeSummary}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900">{t('ملخص الرحلة', 'Flight summary')}</h2>
          <p className="mt-2 text-sm text-slate-700">{model.flightSummary}</p>
          <p className="mt-1 text-xs text-slate-500">
            {t('مرجع الحجز', 'Booking reference')}: {model.bookingReference}
          </p>
        </section>

        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900">{t('المسافرون', 'Passenger summary')}</h2>
          {model.passengerLines.length > 0 ? (
            <ul className="mt-2 space-y-1 text-xs text-slate-700">
              {model.passengerLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-slate-500">{t('لا توجد بيانات', 'No passengers')}</p>
          )}
        </section>

        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900">{t('تفصيل الأجرة', 'Fare breakdown')}</h2>
          <dl className="mt-2 space-y-1 text-xs text-slate-700">
            <div className="flex justify-between">
              <dt>{t('الأجرة الأساسية', 'Base fare')}</dt>
              <dd>{model.baseFare}</dd>
            </div>
            <div className="flex justify-between">
              <dt>{t('الضرائب', 'Taxes')}</dt>
              <dd>{model.taxes}</dd>
            </div>
            <div className="flex justify-between">
              <dt>{t('الرسوم', 'Fees')}</dt>
              <dd>{model.fees}</dd>
            </div>
            {order.fareBreakdown.discount > 0 && (
              <div className="flex justify-between">
                <dt>{t('الخصم', 'Discount')}</dt>
                <dd>-{model.discount}</dd>
              </div>
            )}
            <div className="flex justify-between border-t border-slate-100 pt-2 font-bold text-sm">
              <dt>{t('الإجمالي', 'Total price')}</dt>
              <dd>{model.total}</dd>
            </div>
          </dl>
          <p className="mt-2 text-[11px] text-slate-400">
            {t('حالة الدفع', 'Payment')}: {model.paymentStatusLabel}
          </p>
        </section>

        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900">{t('شروط الحجز', 'Booking conditions')}</h2>
          <ul className="mt-2 space-y-2 text-xs text-slate-600">
            {model.bookingConditions.map((c) => (
              <li key={c} className="flex gap-2">
                <span className="text-slate-400">•</span>
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900">{t('سياسة الإلغاء', 'Cancellation policy')}</h2>
          <p className="mt-2 text-xs text-slate-600">{model.cancellationPolicy}</p>
        </section>

        {timelineEnabled && timelineEvents.length > 0 && (
          <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold text-slate-900">{t('الخط الزمني', 'Order timeline')}</h2>
            <div className="mt-3">
              <BookingTimeline
                events={timelineEvents}
                locale={locale}
                activeType={activeOrderTimelineType(order)}
              />
            </div>
          </section>
        )}

        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <input
            type="checkbox"
            checked={acceptedTerms}
            onChange={(e) => setAcceptedTerms(e.target.checked)}
            data-testid="order-checkout-terms"
            className="mt-1 h-4 w-4 rounded border-slate-300 text-primary-600"
          />
          <span className="text-sm text-slate-700">
            {t(
              'أوافق على شروط الحجز وسياسة الخصوصية، وأؤكد صحة البيانات.',
              'I agree to the booking conditions and privacy policy, and confirm the details are correct.',
            )}
          </span>
        </label>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div>
            <p className="text-xs text-slate-500">{t('الإجمالي', 'Total')}</p>
            <p className="text-xl font-bold text-slate-900">{model.total}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {order.bookingSessionId && (
              <Link
                to={`/booking/confirmation/${encodeURIComponent(order.bookingSessionId)}`}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                {t('التأكيد', 'Confirmation')}
              </Link>
            )}
            <button
              type="button"
              disabled={busy || !acceptedTerms || !paymentEnabled || order.orderStatus === 'paid'}
              onClick={() => void handlePay()}
              data-testid="order-checkout-pay"
              className="rounded-xl bg-primary-600 px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {busy
                ? t('جاري…', 'Working…')
                : order.orderStatus === 'paid'
                  ? t('مدفوع', 'Paid')
                  : t('المتابعة للدفع', 'Continue to payment')}
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
