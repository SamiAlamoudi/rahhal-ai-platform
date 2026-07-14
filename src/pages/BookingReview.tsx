import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useLocation, Navigate } from 'react-router-dom'
import type { BookingSession, BookingItem, BookingItemType } from '../lib/booking/bookingTypes'
import {
  loadTripBookingSession,
  confirmTripBookingSelection,
} from '../lib/booking/bookingSessionService'

interface BookingReviewLocationState {
  bookingSessionId?: string
}

const TYPE_LABELS: Record<BookingItemType, string> = {
  flight: 'طيران',
  hotel: 'فنادق',
  rental_car: 'تأجير سيارات',
  activity: 'أنشطة',
  transfer: 'مواصلات',
  insurance: 'تأمين',
  esim: 'eSIM',
}

const TYPE_ICONS: Record<BookingItemType, string> = {
  flight: '✈️',
  hotel: '🏨',
  rental_car: '🚙',
  activity: '🎯',
  transfer: '🚗',
  insurance: '🛡️',
  esim: '📱',
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'مسودة',
  selected: 'تم الاختيار',
  ready_to_redirect: 'جاهز للتحويل',
  redirected: 'تم التحويل',
  pending_provider_confirmation: 'بانتظار تأكيد المزود',
  confirmed: 'مؤكد',
  failed: 'فشل',
  cancelled: 'ملغي',
  expired: 'منتهي',
}

function formatPrice(price: number, currency: string): string {
  try {
    return new Intl.NumberFormat('ar-SA', {
      style: 'currency',
      currency: currency || 'SAR',
      maximumFractionDigits: 0,
    }).format(price)
  } catch {
    return `${price.toLocaleString('ar-SA')} ${currency}`
  }
}

function metaString(item: BookingItem | null, key: string): string | null {
  if (!item) return null
  const value = item.metadata?.[key]
  return typeof value === 'string' && value ? value : null
}

export default function BookingReview() {
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as BookingReviewLocationState | null
  const bookingSessionId = state?.bookingSessionId
    ?? new URLSearchParams(location.search).get('id')
    ?? null

  const [session, setSession] = useState<BookingSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [confirmedMessage, setConfirmedMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!bookingSessionId) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    const result = await loadTripBookingSession(bookingSessionId)
    if (result.error || !result.session) {
      setSession(null)
      setError(result.error ?? 'تعذّر تحميل جلسة الحجز')
    } else {
      setSession(result.session)
    }
    setLoading(false)
  }, [bookingSessionId])

  useEffect(() => {
    void load()
  }, [load])

  if (!bookingSessionId) {
    return <Navigate to="/search" replace />
  }

  const flight = session?.items.find((item) => item.type === 'flight') ?? null
  const hotel = session?.items.find((item) => item.type === 'hotel') ?? null
  const selectionConfirmed = !!session?.confirmedAt

  const handleConfirmSelection = async () => {
    if (!bookingSessionId || confirming) return
    setConfirming(true)
    setError(null)
    const result = await confirmTripBookingSelection(bookingSessionId)
    if (!result.session) {
      setError(result.error ?? 'تعذّر تأكيد الاختيار')
    } else {
      setSession(result.session)
      setConfirmedMessage(
        result.error
          ? 'تم تأكيد الاختيار محلياً، لكن المزامنة مع الخادم فشلت.'
          : 'تم تأكيد اختيارك. لم يتم تنفيذ أي دفع.',
      )
    }
    setConfirming(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50/40 via-white to-white">
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/search')}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100"
              aria-label="العودة للبحث"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
            <div>
              <h1 className="text-base font-bold text-slate-900">مراجعة الحجز</h1>
              <p className="text-[10px] text-slate-400">راجع الطيران والفندق قبل تأكيد الاختيار</p>
            </div>
          </div>
          {session && (
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${
              selectionConfirmed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
            }`}>
              {selectionConfirmed ? 'اختيار مؤكد' : (STATUS_LABELS[session.status] ?? session.status)}
            </span>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        {loading && (
          <div className="flex items-center justify-center py-16" aria-label="جاري التحميل">
            <div className="flex flex-col items-center gap-3">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
              <p className="text-sm text-slate-500">جاري تحميل جلسة الحجز...</p>
            </div>
          </div>
        )}

        {!loading && error && (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {!loading && confirmedMessage && (
          <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {confirmedMessage}
          </div>
        )}

        {!loading && session && (
          <div className="space-y-6">
            {/* Trip meta */}
            <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-sm font-bold text-slate-900">تفاصيل الرحلة</h2>
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <div>
                  <p className="text-[10px] text-slate-400">من</p>
                  <p className="font-bold text-slate-800">
                    {metaString(flight ?? hotel, 'origin') ?? '—'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400">إلى</p>
                  <p className="font-bold text-slate-800">
                    {metaString(flight ?? hotel, 'destination') ?? '—'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400">المغادرة</p>
                  <p className="font-bold text-slate-800">
                    {metaString(flight ?? hotel, 'departureDate') ?? '—'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400">العودة</p>
                  <p className="font-bold text-slate-800">
                    {metaString(flight ?? hotel, 'returnDate') ?? '—'}
                  </p>
                </div>
              </div>
              {(flight?.travelerSummary || hotel?.travelerSummary) && (
                <p className="mt-3 text-xs text-slate-500">
                  المسافرون: {flight?.travelerSummary || hotel?.travelerSummary}
                </p>
              )}
            </section>

            {/* Items */}
            <div className="space-y-3">
              {session.items.map((item: BookingItem) => (
                <div key={item.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl" aria-hidden>{TYPE_ICONS[item.type] ?? '📋'}</span>
                      <div>
                        <h3 className="font-bold text-slate-900">{item.title}</h3>
                        <p className="mt-0.5 text-xs text-slate-500">{item.providerName}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-medium text-slate-600">
                            {TYPE_LABELS[item.type] ?? item.type}
                          </span>
                          {item.type === 'hotel' && metaString(item, 'checkIn') && (
                            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-medium text-slate-600">
                              {metaString(item, 'checkIn')} → {metaString(item, 'checkOut')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <p className="font-bold text-slate-900">{formatPrice(item.price, item.currency)}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Totals */}
            <section className="rounded-2xl border border-primary-100 bg-gradient-to-bl from-primary-50/40 to-white p-5 shadow-sm">
              <h2 className="mb-3 text-sm font-bold text-slate-900">السعر التقديري الإجمالي</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>المجموع الفرعي</span>
                  <span>{formatPrice(session.subtotal, session.currency)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>رسوم رحّال</span>
                  <span>{formatPrice(session.fees, session.currency)}</span>
                </div>
                <div className="flex justify-between border-t border-primary-100 pt-2 font-bold text-primary-700">
                  <span>الإجمالي</span>
                  <span>{formatPrice(session.total, session.currency)}</span>
                </div>
              </div>
              <p className="mt-3 text-[11px] text-slate-500">
                لا يوجد دفع داخل رحّال في هذه المرحلة. تأكيد الاختيار يحفظ جلستك فقط.
              </p>
            </section>

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
              <button
                type="button"
                onClick={() => navigate('/search')}
                className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
              >
                العودة لتعديل الاختيار
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmSelection()}
                disabled={confirming || selectionConfirmed || !flight || !hotel}
                className="rounded-xl bg-primary-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {selectionConfirmed
                  ? 'تم تأكيد الاختيار'
                  : confirming
                    ? 'جاري التأكيد...'
                    : 'تأكيد الاختيار'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
