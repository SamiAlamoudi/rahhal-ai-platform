import { useMemo } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { BookingAssistantConfirmationPanel } from '../components/bookingAssistantExecution'
import {
  buildSharePayload,
  getBookingExecutionSession,
  isBookingExecutionConfirmationEnabled,
} from '../lib/bookingExecutionConfirmation'

/**
 * Sprint 102 — Booking Assistant Confirmation page.
 * Additive — does not replace legacy /booking/confirmation.
 */
export default function BookingAssistantConfirmationPage() {
  const { bookingId = '' } = useParams<{ bookingId: string }>()
  const enabled = isBookingExecutionConfirmationEnabled()
  const session = useMemo(
    () => (bookingId ? getBookingExecutionSession(bookingId) : null),
    [bookingId],
  )

  if (!enabled) {
    return <Navigate to="/booking/confirmation" replace />
  }

  if (!bookingId || !session?.confirmation) {
    return <Navigate to="/booking-assistant/review" replace />
  }

  const handleDownload = () => {
    const text = buildSharePayload(bookingId)
    if (!text) return
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${session.confirmation?.bookingReference ?? bookingId}-confirmation.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleShare = async () => {
    const text = buildSharePayload(bookingId)
    if (!text) return
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({ title: 'Rahhal booking', text })
        return
      } catch {
        // fall through to clipboard
      }
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
    }
  }

  return (
    <div
      data-testid="booking-assistant-confirmation-page"
      className="min-h-screen bg-gradient-to-b from-teal-50/50 via-white to-stone-50"
    >
      <header className="border-b border-stone-200/80 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-800">
            رحّال · Confirmation
          </p>
          <Link to="/chat" className="text-sm text-slate-600 hover:text-slate-900">
            Back to chat
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <BookingAssistantConfirmationPanel
          model={session.confirmation}
          onDownload={handleDownload}
          onShare={() => void handleShare()}
        />
      </main>
    </div>
  )
}
