import { useEffect, useMemo, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import {
  createEmptyTraveler,
  type BookingExecutionComposeInput,
  type BookingTravelerDraft,
} from '../core'
import {
  bookNowForBooking,
  confirmTravelersForBooking,
  composeInputFromAssistantSnapshot,
  getBookingExecutionSession,
  isBookingExecutionConfirmationEnabled,
  startBookingExecutionReview,
} from '../lib/bookingExecutionConfirmation'
import {
  BookingAssistantReviewPanel,
  TravelerConfirmationForm,
} from '../components/bookingAssistantExecution'

interface ReviewLocationState {
  compose?: BookingExecutionComposeInput
  snapshot?: Parameters<typeof composeInputFromAssistantSnapshot>[0]
  bookingId?: string
}

/**
 * Sprint 102 — Booking Assistant Review + Traveler Confirmation + Book Now.
 * Additive route — does not replace legacy /booking/review.
 */
export default function BookingAssistantReviewPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const enabled = isBookingExecutionConfirmationEnabled()
  const state = location.state as ReviewLocationState | null

  const compose = useMemo(() => {
    if (state?.compose) return state.compose
    if (state?.snapshot) return composeInputFromAssistantSnapshot(state.snapshot)
    return composeInputFromAssistantSnapshot({
      destination: 'Dubai',
      origin: 'Riyadh',
      startDate: '2026-08-15',
      endDate: '2026-08-20',
      travelers: 1,
      flightLabel: 'Saudia RUH → DXB',
      hotelLabel: 'Marina Hotel',
      packageLabel: 'Dubai balanced escape',
      baseFare: 3000,
      taxes: 400,
      fees: 200,
      total: 3600,
      savings: 250,
      currency: 'SAR',
      cancellationSummary: 'Free cancellation up to 48 hours before departure.',
      refundable: true,
      flightId: 'flt_demo',
      hotelId: 'htl_demo',
      packageId: 'pkg_demo',
    })
  }, [state])

  const [bookingId, setBookingId] = useState<string | null>(state?.bookingId ?? null)
  const [step, setStep] = useState<'review' | 'travelers'>('review')
  const [travelers, setTravelers] = useState<BookingTravelerDraft[]>([
    createEmptyTraveler('traveler_1'),
  ])
  const [validation, setValidation] = useState(
    () => getBookingExecutionSession(state?.bookingId ?? '')?.travelerValidation ?? null,
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled) return
    if (bookingId && getBookingExecutionSession(bookingId)) return
    const experience = startBookingExecutionReview({ compose })
    if (experience) setBookingId(experience.bookingId)
  }, [bookingId, compose, enabled])

  if (!enabled) {
    return <Navigate to="/booking/review" replace />
  }

  const session = bookingId ? getBookingExecutionSession(bookingId) : null
  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-600">
        Preparing booking review…
      </div>
    )
  }

  const handleContinueToTravelers = () => {
    setStep('travelers')
    setError(null)
  }

  const handleValidateAndBook = async () => {
    if (!bookingId) return
    setBusy(true)
    setError(null)
    const confirmed = confirmTravelersForBooking(bookingId, travelers)
    setValidation(confirmed?.travelerValidation ?? null)
    if (!confirmed?.travelerValidation?.ok) {
      setBusy(false)
      setError('Please complete required traveler fields.')
      return
    }
    const result = await bookNowForBooking({
      bookingId,
      compose,
      travelers,
    })
    setBusy(false)
    if (!result?.bookNowResult?.ok) {
      setError(result?.bookNowResult?.error ?? 'Booking failed.')
      return
    }
    navigate(`/booking-assistant/confirmation/${result.bookingId}`)
  }

  return (
    <div
      data-testid="booking-assistant-review-page"
      className="min-h-screen bg-gradient-to-b from-stone-100 via-white to-teal-50/40"
    >
      <header className="border-b border-stone-200/80 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-800">
              بيلامو · Booking Assistant
            </p>
            <h1 className="mt-1 text-xl font-semibold text-slate-900">
              {step === 'review' ? 'Booking review' : 'Confirm travelers'}
            </h1>
          </div>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="text-sm text-slate-600 hover:text-slate-900"
          >
            Back
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-8 px-4 py-8 sm:px-6">
        {step === 'review' ? (
          <>
            <BookingAssistantReviewPanel model={session.review} />
            {session.review.travelers.length > 0 && (
              <section data-testid="booking-assistant-traveler-preview" className="space-y-2">
                <h2 className="text-lg font-semibold text-slate-900">Traveler information</h2>
                <p className="text-sm text-slate-600">
                  {session.review.travelers.length} traveler draft(s) ready for confirmation.
                </p>
              </section>
            )}
            <button
              type="button"
              data-testid="booking-assistant-continue-travelers"
              onClick={handleContinueToTravelers}
              className="rounded-md bg-teal-800 px-5 py-2.5 text-sm font-medium text-white hover:bg-teal-900"
            >
              Continue to traveler confirmation
            </button>
          </>
        ) : (
          <>
            <TravelerConfirmationForm
              travelers={travelers}
              validation={validation}
              onChange={setTravelers}
              onAddTraveler={() => setTravelers((prev) => [...prev, createEmptyTraveler()])}
            />
            {error && (
              <p data-testid="booking-assistant-error" className="text-sm text-rose-600">
                {error}
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                data-testid="booking-assistant-book-now"
                disabled={busy}
                onClick={() => void handleValidateAndBook()}
                className="rounded-md bg-teal-800 px-5 py-2.5 text-sm font-medium text-white hover:bg-teal-900 disabled:opacity-60"
              >
                {busy ? 'Booking…' : 'Book Now'}
              </button>
              <button
                type="button"
                onClick={() => setStep('review')}
                className="rounded-md border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700"
              >
                Back to review
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
