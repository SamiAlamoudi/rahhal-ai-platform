import { useState, useEffect, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  getBookingOrchestrator,
  bookingSessionFromRow,
  bookingSessionRepository,
  bookingItemRepository,
} from '../lib/booking'
import type { BookingSession } from '../lib/booking/bookingTypes'
import { loadOrdersForUser } from '../lib/payment/checkoutPersistence'
import type { RahhalOrder } from '../lib/payment/checkoutTypes'

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

const ORDER_STATUS_LABELS: Record<string, string> = {
  draft: 'مسودة',
  created: 'تم الإنشاء',
  pending_payment: 'بانتظار الدفع',
  paid: 'مدفوع',
  confirmed: 'مؤكد',
  failed: 'فشل',
  cancelled: 'ملغي',
  refunded: 'مسترد',
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  selected: 'bg-sky-100 text-sky-700',
  ready_to_redirect: 'bg-indigo-100 text-indigo-700',
  redirected: 'bg-amber-100 text-amber-700',
  pending_provider_confirmation: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-emerald-100 text-emerald-700',
  created: 'bg-sky-100 text-sky-700',
  pending_payment: 'bg-amber-100 text-amber-700',
  paid: 'bg-emerald-100 text-emerald-700',
  failed: 'bg-rose-100 text-rose-600',
  cancelled: 'bg-slate-100 text-slate-400',
  expired: 'bg-rose-100 text-rose-400',
  refunded: 'bg-indigo-100 text-indigo-700',
}

const TYPE_ICONS: Record<string, string> = {
  flight: '✈️',
  hotel: '🏨',
  rental_car: '🚙',
  activity: '🎯',
  transfer: '🚗',
  insurance: '🛡️',
  esim: '📱',
}

function formatPrice(price: number, currency: string): string {
  return `${price.toLocaleString('en-US')} ${currency}`
}

export default function MyTrips() {
  const navigate = useNavigate()
  const orchestrator = useMemo(() => getBookingOrchestrator(), [])
  const [sessions, setSessions] = useState<BookingSession[]>(() => orchestrator.getAllSessions())
  const [orders, setOrders] = useState<RahhalOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const rows = await bookingSessionRepository.listByUser(50)
        const hydrated: BookingSession[] = []
        for (const row of rows) {
          const itemRows = await bookingItemRepository.listBySession(row.id)
          const session = bookingSessionFromRow(row, itemRows)
          if (typeof orchestrator.importSession === 'function') {
            hydrated.push(orchestrator.importSession(session))
          } else {
            hydrated.push(session)
          }
        }
        if (!cancelled) {
          const memory = orchestrator.getAllSessions()
          const byId = new Map<string, BookingSession>()
          for (const s of memory) byId.set(s.id, s)
          for (const s of hydrated) byId.set(s.id, s)
          setSessions([...byId.values()].sort(
            (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
          ))
        }
      } catch {
        if (!cancelled) {
          setSessions(orchestrator.getAllSessions())
        }
      }

      try {
        const userOrders = await loadOrdersForUser(50)
        if (!cancelled) setOrders(userOrders)
      } catch {
        if (!cancelled) setOrders([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [orchestrator])

  const handleResume = (session: BookingSession) => {
    if (session.status === 'redirected' || session.status === 'pending_provider_confirmation') {
      const params = new URLSearchParams({
        bookingSessionId: session.id,
        provider: session.providerReferences[0]?.providerId ?? '',
        status: session.status,
      })
      navigate(`/booking/return?${params.toString()}`)
    } else if (session.status === 'ready_to_redirect' || session.status === 'selected' || session.status === 'draft') {
      navigate('/booking/review', {
        state: {
          selectedItems: [],
          travelSessionId: session.travelSessionId,
          currency: session.currency,
        },
      })
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50/50 via-white to-white">
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100"
              aria-label="رجوع"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
            <div>
              <h1 className="text-base font-bold text-slate-900">رحلاتي</h1>
              <p className="text-[10px] text-slate-400">حجوزاتك وخطط سفرك</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/saved-trips"
              className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200"
            >
              المحفوظة
            </Link>
            <Link
              to="/settings"
              className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200"
            >
              الإعدادات
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 space-y-8">
        {loading && (
          <p className="text-center text-sm text-slate-400">جاري تحميل رحلاتك...</p>
        )}

        <section>
          <h2 className="mb-3 text-sm font-bold text-slate-900">جلسات الحجز</h2>
          {sessions.length === 0 && !loading ? (
            <div className="rounded-2xl border border-dashed border-slate-200 py-12 text-center">
              <span className="text-3xl">🧳</span>
              <p className="mt-2 text-sm text-slate-500">لا توجد رحلات محفوظة بعد</p>
              <button
                type="button"
                onClick={() => navigate('/search')}
                className="mt-4 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-primary-700"
              >
                ابدأ التخطيط لرحلة
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.map((session: BookingSession) => (
                <div key={session.id} className="rounded-2xl border border-slate-100 bg-white shadow-sm">
                  <button
                    type="button"
                    onClick={() => setExpandedId(expandedId === session.id ? null : session.id)}
                    className="flex w-full items-center justify-between p-4 text-right"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex -space-x-1">
                        {session.items.slice(0, 3).map(item => (
                          <span key={item.id} className="text-lg" aria-hidden>
                            {TYPE_ICONS[item.type] ?? '📋'}
                          </span>
                        ))}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">
                          {session.items.length} عنصر · {formatPrice(session.total, session.currency)}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {new Date(session.createdAt).toLocaleDateString('ar-SA')}
                        </p>
                      </div>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${STATUS_COLORS[session.status] ?? 'bg-slate-100 text-slate-500'}`}>
                      {STATUS_LABELS[session.status] ?? session.status}
                    </span>
                  </button>

                  {expandedId === session.id && (
                    <div className="border-t border-slate-50 p-4">
                      <div className="space-y-2 mb-4">
                        {session.items.map(item => (
                          <div key={item.id} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <span aria-hidden>{TYPE_ICONS[item.type] ?? '📋'}</span>
                              <span className="text-slate-700">{item.title}</span>
                            </div>
                            <span className="text-slate-500 text-xs">{formatPrice(item.price, item.currency)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleResume(session)}
                          disabled={session.status === 'confirmed' || session.status === 'cancelled' || session.status === 'expired'}
                          className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-primary-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed"
                        >
                          متابعة الحجز
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-sm font-bold text-slate-900">طلبات الدفع</h2>
          {orders.length === 0 && !loading ? (
            <p className="rounded-2xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">
              لا توجد طلبات دفع بعد
            </p>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => (
                <div key={order.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-mono text-xs text-slate-500">{order.orderNumber}</p>
                      <p className="mt-1 font-bold text-slate-900">
                        {formatPrice(order.cart.total, order.cart.currency)}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {new Date(order.createdAt).toLocaleDateString('ar-SA')}
                      </p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${STATUS_COLORS[order.status] ?? 'bg-slate-100 text-slate-500'}`}>
                      {ORDER_STATUS_LABELS[order.status] ?? order.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
