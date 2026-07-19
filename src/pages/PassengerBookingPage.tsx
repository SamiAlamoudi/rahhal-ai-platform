import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { getFeatureRegistry } from '../lib/ai'
import type { BookingSelectedItem } from '../lib/booking'
import {
  buildFareBreakdown,
  buildPassengerConciergeSummary,
  createPassengerSlots,
  fareBreakdownFromSession,
  flightSummaryFromBookingItem,
  loadPassengerDraft,
  persistPassengersToSession,
  readCountsFromSession,
  readPassengersFromSession,
  resolveBookingSession,
  savePassengerDraft,
  validatePassenger,
  validatePassengerParty,
  type Passenger,
  type PassengerField,
  type PassengerValidationResult,
} from '../lib/passengers'
import {
  BookingSummaryCard,
  PassengerConciergeBanner,
  PassengerFormList,
} from '../components/passengers'
import type { BookingSession } from '../lib/booking'

interface PassengerBookingLocationState {
  bookingSessionId?: string
  selectedItems?: BookingSelectedItem[]
  travelSessionId?: string | null
  currency?: string
  locale?: 'ar' | 'en'
}

function departureDateFromSession(session: BookingSession): string {
  const item = session.items.find((i) => i.type === 'flight') ?? session.items[0]
  const itinerary = (item?.metadata.selectedItinerary ?? {}) as { departureTime?: string }
  const raw = itinerary.departureTime || ''
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10)
  // Fallback: tomorrow so age validation still has a reference
  return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

export default function PassengerBookingPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { user, loading: authLoading } = useAuth()
  const state = location.state as PassengerBookingLocationState | null
  const locale = state?.locale ?? 'en'
  const enabled = getFeatureRegistry().isEnabled('ui.passenger_booking_flow')

  const sessionId = state?.bookingSessionId || searchParams.get('session') || ''

  const [session, setSession] = useState<BookingSession | null>(null)
  const [passengers, setPassengers] = useState<Passenger[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [partyError, setPartyError] = useState<string | null>(null)
  const [errorsByPassenger, setErrorsByPassenger] = useState<
    Record<string, PassengerValidationResult['fieldMessages']>
  >({})

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
        const resolved = await resolveBookingSession(sessionId, user.id)
        if (cancelled) return
        if (!resolved) {
          setError(locale === 'ar' ? 'تعذّر تحميل جلسة الحجز.' : 'Could not load booking session.')
          setSession(null)
          return
        }
        setSession(resolved)
        const counts = readCountsFromSession(resolved)
        const fromSession = readPassengersFromSession(resolved)
        const draft = loadPassengerDraft(resolved.id)
        const initial = fromSession ?? draft ?? createPassengerSlots(counts)
        setPassengers(initial)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [enabled, authLoading, user?.id, sessionId, locale])

  const counts = useMemo(
    () => (session ? readCountsFromSession(session) : { adults: 0, children: 0, infants: 0, total: 0 }),
    [session],
  )

  const departureDate = useMemo(
    () => (session ? departureDateFromSession(session) : new Date().toISOString().slice(0, 10)),
    [session],
  )

  const flight = useMemo(
    () => (session ? flightSummaryFromBookingItem(session.items.find((i) => i.type === 'flight') ?? session.items[0]) : null),
    [session],
  )

  const fare = useMemo(() => {
    if (!session) return buildFareBreakdown(0, 'SAR')
    return fareBreakdownFromSession(session)
  }, [session])

  const concierge = useMemo(
    () => buildPassengerConciergeSummary({
      counts,
      passengers,
      locale,
      remindPassportExpiry: true,
    }),
    [counts, passengers, locale],
  )

  const handleChange = useCallback((id: string, field: PassengerField, value: string) => {
    setPassengers((prev) => {
      const next = prev.map((p) => (p.id === id ? { ...p, [field]: value } : p))
      if (sessionId) savePassengerDraft(sessionId, next)
      return next
    })
    setErrorsByPassenger((prev) => {
      if (!prev[id]?.[field]) return prev
      const copy = { ...prev, [id]: { ...prev[id] } }
      delete copy[id][field]
      return copy
    })
  }, [sessionId])

  const handleContinue = useCallback(async () => {
    if (!session || !user?.id) return
    setSaving(true)
    setError(null)
    setPartyError(null)

    const party = validatePassengerParty(passengers, counts, {
      locale,
      departureDate,
    })

    const byPax: Record<string, PassengerValidationResult['fieldMessages']> = {}
    passengers.forEach((p) => {
      const result = validatePassenger(p, { locale, departureDate })
      if (!result.valid) byPax[p.id] = result.fieldMessages
    })
    setErrorsByPassenger(byPax)

    if (!party.valid) {
      setPartyError(party.fieldMessages.counts || party.errors[0]?.message || 'Validation failed')
      setSaving(false)
      return
    }

    try {
      const result = await persistPassengersToSession({
        sessionId: session.id,
        passengers,
        counts,
        passengersComplete: true,
      })
      navigate('/booking/review', {
        state: {
          bookingSessionId: result.session.id,
          selectedItems: state?.selectedItems,
          travelSessionId: state?.travelSessionId ?? result.session.travelSessionId,
          currency: result.session.currency,
        },
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save passengers')
    } finally {
      setSaving(false)
    }
  }, [session, user?.id, passengers, counts, locale, departureDate, navigate, state])

  if (!enabled) {
    return <Navigate to="/booking/review" replace state={state ?? undefined} />
  }

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
      </div>
    )
  }

  if (!user?.id) {
    return <Navigate to="/login" replace />
  }

  if (!sessionId || !session) {
    return <Navigate to="/my-trips" replace />
  }

  const t = (ar: string, en: string) => (locale === 'ar' ? ar : en)

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-sky-50/40">
      <header className="sticky top-0 z-20 border-b border-slate-100 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div>
            <h1 className="text-base font-bold text-slate-900">
              {t('بيانات المسافرين', 'Passenger details')}
            </h1>
            <p className="text-[10px] text-slate-400">
              {t('أكمل بيانات جواز السفر قبل تأكيد الحجز', 'Complete passport details before confirming')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
          >
            {t('رجوع', 'Back')}
          </button>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-6 px-4 py-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <PassengerConciergeBanner summary={concierge} />

          {(error || partyError) && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error || partyError}
            </div>
          )}

          <PassengerFormList
            passengers={passengers}
            locale={locale}
            errorsByPassenger={errorsByPassenger}
            onChange={handleChange}
          />

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                void persistPassengersToSession({
                  sessionId: session.id,
                  passengers,
                  counts,
                  passengersComplete: false,
                }).catch((err) => {
                  setError(err instanceof Error ? err.message : 'Save failed')
                })
              }}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              {t('حفظ ومتابعة لاحقاً', 'Save for later')}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleContinue()}
              className="rounded-xl bg-primary-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-primary-700 disabled:opacity-60"
            >
              {saving
                ? t('جاري الحفظ…', 'Saving…')
                : t('متابعة لمراجعة الحجز', 'Continue to booking review')}
            </button>
          </div>
        </div>

        <BookingSummaryCard
          flight={flight}
          passengers={passengers}
          fare={fare}
          sessionId={session.id}
          locale={locale}
        />
      </main>
    </div>
  )
}
