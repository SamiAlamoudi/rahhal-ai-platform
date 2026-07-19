/**
 * Continue Booking projection from BookingSession / BookingRecord.
 */

import type { BookingRecord } from '../booking/bookingRecord'
import type { BookingSession } from '../booking/bookingTypes'
import { canResumeBookingSession } from '../booking/myTripsActions'
import { findManagedOrderBySessionId } from '../orderManagement'
import type { ContinueBookingModel, ContinueBookingStep, ContinueBookingStepId, HomeLocale } from './types'

function statusLabels(status: string): { ar: string; en: string } {
  switch (status) {
    case 'draft':
      return { ar: 'مسودة', en: 'Draft' }
    case 'selected':
      return { ar: 'تم اختيار الرحلة', en: 'Flight selected' }
    case 'ready_to_redirect':
      return { ar: 'جاهز للمتابعة', en: 'Ready to continue' }
    case 'redirected':
      return { ar: 'بانتظار المزوّد', en: 'Awaiting provider' }
    case 'pending_provider_confirmation':
      return { ar: 'تأكيد المزوّد', en: 'Provider confirmation' }
    case 'failed':
      return { ar: 'فشل', en: 'Failed' }
    default:
      return { ar: status, en: status }
  }
}

function buildSteps(record: BookingRecord): ContinueBookingStep[] {
  const passengersDone = record.passengersComplete
  const hasFlight = Boolean(record.flight) || record.itemTitles.length > 0
  const order = findManagedOrderBySessionId(record.sessionId)
  const paid = order?.orderStatus === 'paid' || order?.orderStatus === 'confirmed'
  const confirmed = record.status === 'confirmed'

  let current: ContinueBookingStepId = 'select_flight'
  if (!hasFlight) current = 'select_flight'
  else if (!passengersDone) current = 'passengers'
  else if (!confirmed && !order) current = 'review'
  else if (order && !paid) current = 'payment'
  else if (paid || confirmed) current = 'complete'
  else current = 'confirm'

  const defs: Array<{ id: ContinueBookingStepId; labelAr: string; labelEn: string; done: boolean }> = [
    { id: 'select_flight', labelAr: 'اختيار الرحلة', labelEn: 'Select flight', done: hasFlight },
    { id: 'passengers', labelAr: 'بيانات المسافرين', labelEn: 'Passengers', done: passengersDone },
    {
      id: 'review',
      labelAr: 'مراجعة الحجز',
      labelEn: 'Review booking',
      done: passengersDone && (confirmed || Boolean(order) || record.status !== 'draft'),
    },
    {
      id: 'confirm',
      labelAr: 'تأكيد الحجز',
      labelEn: 'Confirm booking',
      done: confirmed || Boolean(order),
    },
    { id: 'payment', labelAr: 'الدفع', labelEn: 'Payment', done: Boolean(paid) },
    { id: 'complete', labelAr: 'اكتمال', labelEn: 'Complete', done: Boolean(paid) || confirmed },
  ]

  return defs.map((d) => ({
    ...d,
    current: d.id === current,
  }))
}

export interface ResumeTarget {
  path: string
  state?: Record<string, unknown>
}

export function resolveContinueResumeTarget(
  record: BookingRecord,
  session: BookingSession | null,
): ResumeTarget {
  const status = session?.status ?? record.status
  if (status === 'redirected' || status === 'pending_provider_confirmation') {
    const params = new URLSearchParams({
      bookingSessionId: record.sessionId,
      provider: session?.providerReferences[0]?.providerId ?? '',
      status,
    })
    return { path: `/booking/return?${params.toString()}` }
  }

  const order = findManagedOrderBySessionId(record.sessionId)
  if (order && (order.orderStatus === 'awaiting_payment' || order.orderStatus === 'payment_failed')) {
    return { path: order.checkoutPath }
  }

  if (record.passengersComplete || session?.items[0]?.metadata?.passengersComplete) {
    return {
      path: '/booking/review',
      state: {
        bookingSessionId: record.sessionId,
        travelSessionId: session?.travelSessionId ?? null,
        currency: record.currency,
        selectedItems: [],
      },
    }
  }

  return {
    path: '/booking/passengers',
    state: {
      bookingSessionId: record.sessionId,
      travelSessionId: session?.travelSessionId ?? null,
      currency: record.currency,
    },
  }
}

export function buildContinueBookingModel(
  record: BookingRecord,
  session: BookingSession | null,
): ContinueBookingModel | null {
  if (!canResumeBookingSession(record.status) && record.status !== 'failed') {
    // Also allow resume when confirmed but awaiting payment via order
    const order = findManagedOrderBySessionId(record.sessionId)
    if (!(order && (order.orderStatus === 'awaiting_payment' || order.orderStatus === 'payment_failed'))) {
      return null
    }
  }

  const labels = statusLabels(record.status)
  const resume = resolveContinueResumeTarget(record, session)
  const title = record.flight
    ? `${record.flight.origin} → ${record.flight.destination}`
    : record.itemTitles[0] ?? record.bookingReference

  return {
    sessionId: record.sessionId,
    bookingReference: record.bookingReference,
    title,
    status: record.status,
    statusLabelAr: labels.ar,
    statusLabelEn: labels.en,
    remainingSteps: buildSteps(record).filter((s) => !s.done || s.current),
    resumePath: resume.path,
    resumeState: resume.state,
  }
}

export function findContinueBookingCandidate(
  records: BookingRecord[],
): BookingRecord | null {
  const resumable = records.filter(
    (r) => canResumeBookingSession(r.status) || r.status === 'failed',
  )
  if (resumable.length === 0) {
    // Check for awaiting-payment orders linked to any record
    for (const r of records) {
      const order = findManagedOrderBySessionId(r.sessionId)
      if (order && (order.orderStatus === 'awaiting_payment' || order.orderStatus === 'payment_failed')) {
        return r
      }
    }
    return null
  }
  return [...resumable].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null
}

export function continueBookingHeadline(_model: ContinueBookingModel, locale: HomeLocale): string {
  return locale === 'ar' ? 'متابعة الحجز' : 'Continue booking'
}
