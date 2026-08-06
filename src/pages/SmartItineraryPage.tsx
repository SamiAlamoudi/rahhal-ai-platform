import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { getFeatureRegistry } from '../lib/ai'
import { useAuth } from '../lib/auth'
import {
  resolveBookingSessionForUser,
  toBookingRecord,
} from '../lib/booking'
import {
  getOrGenerateItinerary,
  regenerateTripItinerary,
  type TripItinerary,
} from '../lib/smartItinerary'
import {
  DailyAgenda,
  ItineraryTimeline,
  TravelInsightsPanel,
  TripSummaryCard,
} from '../components/itinerary'

export default function SmartItineraryPage() {
  const { sessionId = '' } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const enabled = getFeatureRegistry().isEnabled('ui.smart_itinerary')
  const insightsEnabled = getFeatureRegistry().isEnabled('ui.travel_insights')
  const plannerEnabled = getFeatureRegistry().isEnabled('ui.daily_planner')
  const locale = 'ar' as const
  const t = (ar: string, en: string) => (locale === 'ar' ? ar : en)

  const [itinerary, setItinerary] = useState<TripItinerary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!user?.id || !sessionId) return
    setLoading(true)
    setError(null)
    try {
      const session = await resolveBookingSessionForUser(sessionId, user.id)
      if (!session) {
        setError(t('الحجز غير موجود', 'Booking not found'))
        setItinerary(null)
        return
      }
      const record = toBookingRecord(session)
      setItinerary(getOrGenerateItinerary(record, {
        includeInsights: insightsEnabled,
        includeDailyPlanner: plannerEnabled,
      }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load itinerary')
    } finally {
      setLoading(false)
    }
  }, [user?.id, sessionId, insightsEnabled, plannerEnabled])

  useEffect(() => {
    if (!enabled || authLoading) return
    void load()
  }, [enabled, authLoading, load])

  const activeType = useMemo(() => {
    if (!itinerary) return null
    const now = Date.now()
    const upcoming = itinerary.timeline.find((i) => i.at && Date.parse(i.at) >= now)
    return upcoming?.type ?? itinerary.timeline[0]?.type ?? null
  }, [itinerary])

  if (!enabled) return <Navigate to="/my-trips" replace />
  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
        <p className="text-xs text-slate-400">{t('جاري بناء الجدول…', 'Building itinerary…')}</p>
      </div>
    )
  }
  if (!user?.id) return <Navigate to="/login" replace />
  if (!sessionId || !itinerary) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-sm text-rose-600">{error || t('تعذر التحميل', 'Could not load')}</p>
        <button
          type="button"
          onClick={() => navigate('/my-trips')}
          className="mt-4 rounded-xl bg-primary-600 px-4 py-2 text-xs font-bold text-white"
        >
          {t('رحلاتي', 'My Trips')}
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-sky-50/40" data-testid="smart-itinerary-page">
      <header className="sticky top-0 z-20 border-b border-slate-100 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
              aria-label={t('رجوع', 'Back')}
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <div>
              <h1 className="text-base font-bold text-slate-900">
                {t('الجدول الذكي', 'Smart itinerary')}
              </h1>
              <p className="text-[10px] text-slate-400">
                {t('رفيق بيلامو بعد التأكيد', 'Bilamo companion after confirmation')}
              </p>
            </div>
          </div>
          <button
            type="button"
            data-testid="itinerary-regenerate"
            onClick={async () => {
              if (!user?.id) return
              const session = await resolveBookingSessionForUser(sessionId, user.id)
              if (!session) return
              setItinerary(regenerateTripItinerary(toBookingRecord(session), {
                includeInsights: insightsEnabled,
                includeDailyPlanner: plannerEnabled,
              }))
            }}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-50"
          >
            {t('تحديث', 'Refresh')}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-5 px-4 py-6">
        {error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <TripSummaryCard summary={itinerary.summary} locale={locale} />

        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-bold text-slate-900">
            {t('الخط الزمني', 'Timeline')}
          </h2>
          <ItineraryTimeline
            items={itinerary.timeline}
            locale={locale}
            activeType={activeType}
          />
        </section>

        {insightsEnabled ? (
          <TravelInsightsPanel
            insights={itinerary.insights}
            locale={locale}
            title={t('رؤى السفر', 'Travel insights')}
          />
        ) : null}

        {plannerEnabled ? (
          <DailyAgenda
            days={itinerary.days}
            locale={locale}
            title={t('المخطط اليومي', 'Daily planner')}
          />
        ) : null}

        <div className="flex flex-wrap gap-2 pt-2">
          <Link
            to={`/booking/confirmation/${encodeURIComponent(sessionId)}`}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            {t('التأكيد', 'Confirmation')}
          </Link>
          <Link
            to={`/my-trips/${encodeURIComponent(sessionId)}`}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            {t('تفاصيل الحجز', 'Booking details')}
          </Link>
          <Link
            to="/chat"
            state={{ seedMessage: locale === 'ar' ? 'أظهر جدولي' : 'Show my itinerary' }}
            className="rounded-xl bg-primary-600 px-4 py-2 text-xs font-bold text-white hover:bg-primary-700"
          >
            {t('اسأل المستشار', 'Ask concierge')}
          </Link>
        </div>
      </main>
    </div>
  )
}
