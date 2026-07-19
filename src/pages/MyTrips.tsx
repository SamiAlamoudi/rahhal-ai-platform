import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import {
  canCancelBookingSession,
  canResumeBookingSession,
  getBookingOrchestrator,
  loadMyTrips,
  syncBookingSession,
  type BookingRecord,
  type MyTripsLists,
  type TripBucket,
} from '../lib/booking'
import { getFeatureRegistry } from '../lib/ai'
import { useAuth } from '../lib/auth'
import {
  MyTripsEmptyState,
  MyTripsErrorState,
  MyTripsLoadingState,
  TripRecordCard,
} from '../components/myTrips'

type TabId = TripBucket | 'all'

const TABS: { id: TabId; ar: string; en: string }[] = [
  { id: 'upcoming', ar: 'القادمة', en: 'Upcoming' },
  { id: 'completed', ar: 'المكتملة', en: 'Completed' },
  { id: 'cancelled', ar: 'الملغاة', en: 'Cancelled' },
  { id: 'all', ar: 'الكل', en: 'All' },
]

export default function MyTrips() {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const myTripsEnabled = getFeatureRegistry().isEnabled('ui.my_trips')
  const confirmationEnabled = getFeatureRegistry().isEnabled('ui.booking_confirmation')
  const orchestrator = useMemo(() => getBookingOrchestrator(), [])

  const [lists, setLists] = useState<MyTripsLists | null>(null)
  const [tab, setTab] = useState<TabId>('upcoming')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const locale: 'ar' | 'en' = 'ar'

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setLists({ upcoming: [], completed: [], cancelled: [], all: [] })
      return
    }
    setError(null)
    try {
      const next = await loadMyTrips(user.id)
      setLists(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load trips')
    }
  }, [user?.id])

  useEffect(() => {
    if (authLoading || !myTripsEnabled) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        if (!user?.id) {
          if (!cancelled) setLists({ upcoming: [], completed: [], cancelled: [], all: [] })
          return
        }
        const next = await loadMyTrips(user.id)
        if (!cancelled) setLists(next)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load trips')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user?.id, authLoading, myTripsEnabled])

  const visible: BookingRecord[] = useMemo(() => {
    if (!lists) return []
    if (tab === 'all') return lists.all
    return lists[tab]
  }, [lists, tab])

  const handleResume = (sessionId: string) => {
    const session = orchestrator.getBookingSession(sessionId)
    if (!session || !canResumeBookingSession(session.status)) return
    if (session.status === 'redirected' || session.status === 'pending_provider_confirmation') {
      const params = new URLSearchParams({
        bookingSessionId: session.id,
        provider: session.providerReferences[0]?.providerId ?? '',
        status: session.status,
      })
      navigate(`/booking/return?${params.toString()}`)
      return
    }
    if (session.items[0]?.metadata?.passengersComplete) {
      navigate('/booking/review', {
        state: {
          bookingSessionId: session.id,
          travelSessionId: session.travelSessionId,
          currency: session.currency,
          selectedItems: [],
        },
      })
      return
    }
    navigate('/booking/passengers', {
      state: {
        bookingSessionId: session.id,
        travelSessionId: session.travelSessionId,
        currency: session.currency,
      },
    })
  }

  const handleCancel = async (sessionId: string) => {
    const session = orchestrator.getBookingSession(sessionId)
    if (!session || !canCancelBookingSession(session.status) || busyId) return
    setBusyId(sessionId)
    setError(null)
    try {
      const fromStatus = session.status
      const updated = orchestrator.cancelBookingSession(sessionId)
      if (!updated || updated.status !== 'cancelled') {
        setError(locale === 'ar' ? 'تعذر إلغاء الحجز' : 'Could not cancel booking')
        return
      }
      await syncBookingSession(updated, fromStatus)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not cancel booking')
    } finally {
      setBusyId(null)
    }
  }

  if (!myTripsEnabled) {
    return <Navigate to="/" replace />
  }

  const t = (ar: string, en: string) => (locale === 'ar' ? ar : en)

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50/50 via-white to-sky-50/30">
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100"
              aria-label={t('رجوع', 'Back')}
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
            <div>
              <h1 className="text-base font-bold text-slate-900">{t('رحلاتي', 'My Trips')}</h1>
              <p className="text-[10px] text-slate-400">
                {t('حجوزاتك وسجلات السفر', 'Your bookings and travel records')}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <div className="mb-4 flex flex-wrap gap-1 rounded-xl border border-slate-100 bg-white p-1 shadow-sm">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                tab === item.id
                  ? 'bg-primary-600 text-white'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {locale === 'ar' ? item.ar : item.en}
              {lists && (
                <span className="ms-1 opacity-80">
                  ({item.id === 'all' ? lists.all.length : lists[item.id].length})
                </span>
              )}
            </button>
          ))}
        </div>

        {authLoading || loading ? (
          <MyTripsLoadingState />
        ) : error && !lists ? (
          <MyTripsErrorState
            message={error}
            locale={locale}
            onRetry={() => {
              setLoading(true)
              void refresh().finally(() => setLoading(false))
            }}
          />
        ) : (
          <>
            {error && (
              <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            )}
            {visible.length === 0 ? (
              <MyTripsEmptyState locale={locale} onStart={() => navigate('/search')} />
            ) : (
              <div className="space-y-3">
                {visible.map((record) => {
                  const session = orchestrator.getBookingSession(record.sessionId)
                  return (
                    <TripRecordCard
                      key={record.sessionId}
                      record={record}
                      locale={locale}
                      busy={busyId === record.sessionId}
                      canResume={session ? canResumeBookingSession(session.status) : false}
                      canCancel={session ? canCancelBookingSession(session.status) : false}
                      onOpen={(id) => {
                        if (confirmationEnabled && (record.status === 'confirmed' || record.status === 'failed' || record.status === 'pending_provider_confirmation' || record.status === 'redirected')) {
                          navigate(`/booking/confirmation/${encodeURIComponent(id)}`)
                          return
                        }
                        navigate(`/my-trips/${encodeURIComponent(id)}`)
                      }}
                      onResume={handleResume}
                      onCancel={(id) => void handleCancel(id)}
                    />
                  )
                })}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
