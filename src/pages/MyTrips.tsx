import { useState, useMemo, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getBookingOrchestrator,
  listUserBookingSessions,
  syncBookingSession,
  canCancelBookingSession,
  canResumeBookingSession,
} from '../lib/booking'
import type { BookingSession } from '../lib/booking/bookingTypes'
import { useAuth } from '../lib/auth'

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

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  selected: 'bg-sky-100 text-sky-700',
  ready_to_redirect: 'bg-indigo-100 text-indigo-700',
  redirected: 'bg-amber-100 text-amber-700',
  pending_provider_confirmation: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-emerald-100 text-emerald-700',
  failed: 'bg-rose-100 text-rose-600',
  cancelled: 'bg-slate-100 text-slate-400',
  expired: 'bg-rose-100 text-rose-400',
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
  const { user, loading: authLoading } = useAuth()
  const orchestrator = useMemo(() => getBookingOrchestrator(), [])
  const [sessions, setSessions] = useState<BookingSession[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const refreshSessions = useCallback(async () => {
    if (!user?.id) {
      setSessions([])
      return
    }
    const loaded = await listUserBookingSessions(user.id)
    orchestrator.replaceUserSessions(user.id, loaded)
    setSessions(orchestrator.getSessionsByUser(user.id))
  }, [orchestrator, user?.id])

  useEffect(() => {
    if (authLoading) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        if (!user?.id) {
          if (!cancelled) setSessions([])
          return
        }
        const loaded = await listUserBookingSessions(user.id)
        orchestrator.replaceUserSessions(user.id, loaded)
        if (!cancelled) setSessions(orchestrator.getSessionsByUser(user.id))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user?.id, orchestrator, authLoading])

  const handleResume = (session: BookingSession) => {
    if (!canResumeBookingSession(session.status)) return
    if (session.status === 'redirected' || session.status === 'pending_provider_confirmation') {
      const params = new URLSearchParams({
        bookingSessionId: session.id,
        provider: session.providerReferences[0]?.providerId ?? '',
        status: session.status,
      })
      navigate(`/booking/return?${params.toString()}`)
      return
    }
    navigate('/booking/review', {
      state: {
        bookingSessionId: session.id,
        travelSessionId: session.travelSessionId,
        currency: session.currency,
        selectedItems: [],
      },
    })
  }

  const handleCancel = async (session: BookingSession) => {
    if (!canCancelBookingSession(session.status) || busyId) return
    setBusyId(session.id)
    setActionError(null)
    try {
      const fromStatus = session.status
      const updated = orchestrator.cancelBookingSession(session.id)
      if (!updated || updated.status !== 'cancelled') {
        setActionError('تعذر إلغاء الحجز')
        return
      }
      await syncBookingSession(updated, fromStatus)
      await refreshSessions()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'تعذر إلغاء الحجز')
    } finally {
      setBusyId(null)
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
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        {actionError && (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {actionError}
          </div>
        )}
        {authLoading || loading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
          </div>
        ) : sessions.length === 0 ? (
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
            {sessions.map((session: BookingSession) => {
              const canResume = canResumeBookingSession(session.status)
              const canCancel = canCancelBookingSession(session.status)
              return (
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
                    <div className="mb-4 space-y-2">
                      {session.items.map(item => (
                        <div key={item.id} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <span aria-hidden>{TYPE_ICONS[item.type] ?? '📋'}</span>
                            <span className="text-slate-700">{item.title}</span>
                          </div>
                          <span className="text-xs text-slate-500">{formatPrice(item.price, item.currency)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleResume(session)}
                        disabled={!canResume || busyId === session.id}
                        className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                      >
                        متابعة الحجز
                      </button>
                      {canCancel && (
                        <button
                          type="button"
                          onClick={() => void handleCancel(session)}
                          disabled={busyId === session.id}
                          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-bold text-rose-700 transition-colors hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {busyId === session.id ? 'جاري الإلغاء...' : 'إلغاء الحجز'}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
