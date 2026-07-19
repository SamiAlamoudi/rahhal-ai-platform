/**
 * Sprint 13 — Concierge-phrased booking history replies.
 * Uses consultant voice; does not import travel suppliers.
 */

import { emptyRequirements } from '../agent/types'
import type { AgentLocale } from '../agent/types'
import { buildConsultantReply } from '../concierge/consultantVoice'
import {
  advanceConciergeState,
  emptyConciergeState,
  emptySoftSignals,
} from '../concierge'
import type { BookingRecord } from './bookingRecord'
import { findLatestBookingRecord } from './myTripsQueries'

export type BookingHistoryIntent =
  | 'show_trips'
  | 'show_latest_booking'
  | 'show_booking_details'
  | 'summarize_itinerary'

function informDecision(heard: string[], rationale: string) {
  // Use propose_options so consultant voice surfaces optionLines (Sprint 11/12 pattern).
  return {
    action: 'propose_options' as const,
    phase: 'advising' as const,
    state: advanceConciergeState({
      previous: emptyConciergeState(),
      phase: 'advising',
      lastAction: 'propose_options',
      softSignals: emptySoftSignals(),
      heardSummary: heard,
    }),
    askFields: [] as never[],
    shouldExecuteAgent: false,
    rationale,
  }
}

function flightLine(record: BookingRecord, locale: AgentLocale): string {
  const f = record.flight
  if (!f) {
    return locale === 'ar'
      ? `${record.itemTitles[0] ?? 'حجز'} · ${record.bookingReference}`
      : `${record.itemTitles[0] ?? 'Booking'} · ${record.bookingReference}`
  }
  const route = `${f.origin || '?'} → ${f.destination || '?'}`
  return locale === 'ar'
    ? `${f.airline || 'رحلة'} ${route} · ${record.bookingReference}`
    : `${f.airline || 'Flight'} ${route} · ${record.bookingReference}`
}

export function buildShowTripsReply(
  records: BookingRecord[],
  locale: AgentLocale,
): string {
  if (records.length === 0) {
    return buildConsultantReply({
      locale,
      decision: informDecision([], 'no-trips'),
      requirements: emptyRequirements(),
      optionLines: [
        locale === 'ar'
          ? 'لا توجد حجوزات في رحلاتي بعد. يمكنك بدء بحث جديد متى شئت.'
          : 'You do not have any bookings in My Trips yet. You can start a new search whenever you like.',
      ],
    })
  }

  const upcoming = records.filter((r) => r.bucket === 'upcoming').length
  const completed = records.filter((r) => r.bucket === 'completed').length
  const cancelled = records.filter((r) => r.bucket === 'cancelled').length
  const lines = records.slice(0, 5).map((r, i) => `${i + 1}. ${flightLine(r, locale)} (${r.status})`)

  const header = locale === 'ar'
    ? `لديك ${records.length} حجزاً — قادمة: ${upcoming}، مكتملة: ${completed}، ملغاة: ${cancelled}.`
    : `You have ${records.length} booking(s) — upcoming: ${upcoming}, completed: ${completed}, cancelled: ${cancelled}.`

  return buildConsultantReply({
    locale,
    decision: informDecision([`trips:${records.length}`], 'show-trips'),
    requirements: emptyRequirements(),
    optionLines: [header, ...lines, locale === 'ar' ? 'افتح «رحلاتي» للتفاصيل.' : 'Open My Trips for full details.'],
  })
}

export function buildLatestBookingReply(
  records: BookingRecord[],
  locale: AgentLocale,
): string {
  const latest = findLatestBookingRecord(records)
  if (!latest) {
    return buildShowTripsReply([], locale)
  }
  const lines = [
    locale === 'ar'
      ? `أحدث حجز لديك هو ${latest.bookingReference}.`
      : `Your latest booking is ${latest.bookingReference}.`,
    flightLine(latest, locale),
    locale === 'ar'
      ? `الحالة: ${latest.status} · الإجمالي: ${latest.fare.grandTotal} ${latest.fare.currency}`
      : `Status: ${latest.status} · Total: ${latest.fare.grandTotal} ${latest.fare.currency}`,
  ]
  return buildConsultantReply({
    locale,
    decision: informDecision([latest.bookingReference], 'latest-booking'),
    requirements: emptyRequirements(),
    optionLines: lines,
  })
}

export function buildBookingDetailsReply(
  record: BookingRecord | null,
  locale: AgentLocale,
): string {
  if (!record) {
    return buildConsultantReply({
      locale,
      decision: informDecision([], 'booking-missing'),
      requirements: emptyRequirements(),
      optionLines: [
        locale === 'ar'
          ? 'لم أجد تفاصيل هذا الحجز. جرّب «أظهر رحلاتي».'
          : 'I could not find that booking. Try “show my trips”.',
      ],
    })
  }

  const pax = record.passengers.length
  const lines = [
    locale === 'ar'
      ? `تفاصيل الحجز ${record.bookingReference}:`
      : `Booking details for ${record.bookingReference}:`,
    flightLine(record, locale),
    locale === 'ar'
      ? `المسافرون: ${pax} · الأجرة ${record.fare.fare} + ضرائب ${record.fare.taxes} = ${record.fare.grandTotal} ${record.fare.currency}`
      : `Passengers: ${pax} · Fare ${record.fare.fare} + tax ${record.fare.taxes} = ${record.fare.grandTotal} ${record.fare.currency}`,
    locale === 'ar' ? `الحالة: ${record.status}` : `Status: ${record.status}`,
  ]
  return buildConsultantReply({
    locale,
    decision: informDecision([record.bookingReference], 'booking-details'),
    requirements: emptyRequirements(),
    optionLines: lines,
  })
}

export function buildItinerarySummaryReply(
  record: BookingRecord | null,
  locale: AgentLocale,
): string {
  if (!record) {
    return buildLatestBookingReply([], locale)
  }
  const f = record.flight
  const names = record.passengers
    .map((p) => `${p.firstName} ${p.lastName}`.trim())
    .filter(Boolean)
  const lines = [
    locale === 'ar' ? 'ملخص رحلتك:' : 'Here is a summary of your itinerary:',
    f
      ? (locale === 'ar'
        ? `${f.airline || 'رحلة'} من ${f.origin} إلى ${f.destination}.`
        : `${f.airline || 'Flight'} from ${f.origin} to ${f.destination}.`)
      : (record.itemTitles[0] ?? (locale === 'ar' ? 'حجز سفر' : 'Travel booking')),
    names.length > 0
      ? (locale === 'ar' ? `المسافرون: ${names.join('، ')}.` : `Travellers: ${names.join(', ')}.`)
      : (locale === 'ar' ? 'بيانات المسافرين غير مكتملة بعد.' : 'Passenger details are not complete yet.'),
    locale === 'ar'
      ? `المرجع: ${record.bookingReference} · ${record.fare.grandTotal} ${record.fare.currency}`
      : `Reference: ${record.bookingReference} · ${record.fare.grandTotal} ${record.fare.currency}`,
  ]
  return buildConsultantReply({
    locale,
    decision: informDecision([record.bookingReference], 'summarize-itinerary'),
    requirements: emptyRequirements(),
    optionLines: lines,
  })
}

export function buildBookingHistoryConciergeReply(input: {
  intent: BookingHistoryIntent
  records: BookingRecord[]
  locale: AgentLocale
  focusSessionId?: string | null
}): string {
  const { intent, records, locale, focusSessionId } = input
  const focused = focusSessionId
    ? records.find((r) => r.sessionId === focusSessionId) ?? null
    : findLatestBookingRecord(records)

  switch (intent) {
    case 'show_trips':
      return buildShowTripsReply(records, locale)
    case 'show_latest_booking':
      return buildLatestBookingReply(records, locale)
    case 'show_booking_details':
      return buildBookingDetailsReply(focused, locale)
    case 'summarize_itinerary':
      return buildItinerarySummaryReply(focused, locale)
    default:
      return buildShowTripsReply(records, locale)
  }
}
