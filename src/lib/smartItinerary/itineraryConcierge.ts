/**
 * Concierge helpers for smart itinerary questions (Sprint 17).
 */

import type { BookingRecord } from '../booking/bookingRecord'
import { getOrGenerateItinerary } from './engine'
import { recommendLeaveForAirport } from './timeHelpers'
import type { DayPlan, ItineraryLocale, TripItinerary } from './types'

export type SmartItineraryConciergeIntent =
  | 'show_my_itinerary'
  | 'whats_todays_plan'
  | 'when_leave_for_airport'
  | 'summarize_my_trip'

function todaysDay(itinerary: TripItinerary, now = new Date()): DayPlan | null {
  const key = now.toISOString().slice(0, 10)
  return itinerary.days.find((d) => d.date === key) ?? itinerary.days[0] ?? null
}

export function answerShowMyItinerary(
  itinerary: TripItinerary,
  locale: ItineraryLocale,
): string {
  const s = itinerary.summary
  if (locale === 'ar') {
    return [
      `## جدول رحلتك`,
      `**${s.titleAr}** · مرجع ${s.bookingReference}`,
      `المدة: ${s.durationDays} أيام · المسافرون: ${s.passengerCount}`,
      `الجدول الزمني: ${itinerary.timeline.length} خطوات`,
      `الأيام المخططة: ${itinerary.days.length}`,
      `افتح الجدول الكامل: /itinerary/${itinerary.bookingSessionId}`,
    ].join('\n')
  }
  return [
    `## Your itinerary`,
    `**${s.titleEn}** · ref ${s.bookingReference}`,
    `Duration: ${s.durationDays} days · Passengers: ${s.passengerCount}`,
    `Timeline steps: ${itinerary.timeline.length}`,
    `Planned days: ${itinerary.days.length}`,
    `Open full itinerary: /itinerary/${itinerary.bookingSessionId}`,
  ].join('\n')
}

export function answerTodaysPlan(
  itinerary: TripItinerary,
  locale: ItineraryLocale,
  now = new Date(),
): string {
  const day = todaysDay(itinerary, now)
  if (!day) {
    return locale === 'ar'
      ? 'لا توجد خطة يومية بعد. أكّد الحجز أولاً.'
      : 'No daily plan yet. Confirm a booking first.'
  }
  const lines = day.parts.map((p) => {
    const title = locale === 'ar' ? p.titleAr : p.titleEn
    const body = locale === 'ar' ? p.bodyAr : p.bodyEn
    return `- **${title}**: ${body}`
  })
  const heading = locale === 'ar' ? day.titleAr : day.titleEn
  const notes = locale === 'ar' ? day.notesAr : day.notesEn
  return [`## ${heading}`, ...lines, '', notes].join('\n')
}

export function answerWhenLeaveForAirport(
  record: BookingRecord,
  locale: ItineraryLocale,
): string {
  const leave = recommendLeaveForAirport(
    record.flight?.departureTime,
    record.flight?.stops ?? null,
  )
  const dep = record.flight?.departureTime
  if (!leave || !dep) {
    return locale === 'ar'
      ? 'لا تتوفر بيانات إقلاع بعد لحساب وقت المغادرة للمطار.'
      : 'Departure time is not available yet to compute when to leave.'
  }
  if (locale === 'ar') {
    return [
      `يُفضّل المغادرة نحو المطار حوالي **${leave.toLocaleString('ar-SA')}**.`,
      `موعد الإقلاع: ${new Date(dep).toLocaleString('ar-SA')}.`,
    ].join('\n')
  }
  return [
    `Plan to leave for the airport around **${leave.toLocaleString('en-US')}**.`,
    `Departure: ${new Date(dep).toLocaleString('en-US')}.`,
  ].join('\n')
}

export function answerSummarizeMyTrip(
  itinerary: TripItinerary,
  locale: ItineraryLocale,
): string {
  const s = itinerary.summary
  const insight = itinerary.insights[0]
  if (locale === 'ar') {
    return [
      `ملخص الرحلة: **${s.titleAr}** مع ${s.airline}.`,
      `المرجع: ${s.bookingReference}` + (s.orderNumber ? ` · الطلب ${s.orderNumber}` : ''),
      `من ${s.origin} إلى ${s.destination} لمدة ${s.durationDays} أيام.`,
      insight ? `نصيحة: ${insight.bodyAr}` : '',
    ].filter(Boolean).join('\n')
  }
  return [
    `Trip summary: **${s.titleEn}** with ${s.airline}.`,
    `Reference: ${s.bookingReference}` + (s.orderNumber ? ` · order ${s.orderNumber}` : ''),
    `${s.origin} → ${s.destination} for ${s.durationDays} days.`,
    insight ? `Tip: ${insight.bodyEn}` : '',
  ].filter(Boolean).join('\n')
}

export function buildSmartItineraryConciergeReply(input: {
  intent: SmartItineraryConciergeIntent
  record: BookingRecord | null
  locale: ItineraryLocale
  now?: Date
}): string {
  if (!input.record) {
    return input.locale === 'ar'
      ? 'لم أجد حجزاً بعد. أكّد رحلة أولاً ثم اسأل عن الجدول.'
      : 'I could not find a booking yet. Confirm a trip first, then ask about the itinerary.'
  }

  const itinerary = getOrGenerateItinerary(input.record)
  switch (input.intent) {
    case 'show_my_itinerary':
      return answerShowMyItinerary(itinerary, input.locale)
    case 'whats_todays_plan':
      return answerTodaysPlan(itinerary, input.locale, input.now)
    case 'when_leave_for_airport':
      return answerWhenLeaveForAirport(input.record, input.locale)
    case 'summarize_my_trip':
      return answerSummarizeMyTrip(itinerary, input.locale)
  }
}
