/**
 * Sprint 35 — Conversation trip query helpers (no duplicated business logic).
 */

import { isTripManagementEnabled } from '../TripFeatureFlags'
import type { PostBookingService } from '../PostBookingService'
import type { PostBookingTripRecord } from '../postBookingTypes'

export type TripConversationQueryKind =
  | 'my_trip'
  | 'show_itinerary'
  | 'download_ticket'
  | 'any_delays'
  | 'what_hotel'

export function detectTripConversationQuery(userText: string): TripConversationQueryKind | null {
  const lower = userText.toLowerCase().trim()

  if (
    /^(my trip|show my trip|my trips|show my trips|what('s| is) my trip)\b/.test(lower)
    || /رحلتي|عرض رحلتي/.test(lower)
  ) {
    return 'my_trip'
  }
  if (
    /show my itinerary|my itinerary|download (my )?itinerary|itinerary please/.test(lower)
    || /عرض جدول|جدول رحلتي/.test(lower)
  ) {
    return 'show_itinerary'
  }
  if (
    /download my ticket|show my ticket|my e-?ticket|boarding pass/.test(lower)
    || /تذكرتي|تحميل التذكرة/.test(lower)
  ) {
    return 'download_ticket'
  }
  if (
    /any delays\??|flight (status|delay)|is my flight delayed|gate change/.test(lower)
    || /تأخير|حالة الرحلة/.test(lower)
  ) {
    return 'any_delays'
  }
  if (
    /what hotel am i staying in|which hotel|my hotel|hotel voucher/.test(lower)
    || /أي فندق|فندقي/.test(lower)
  ) {
    return 'what_hotel'
  }
  return null
}

export function answerTripQuery(input: {
  kind: TripConversationQueryKind
  service: PostBookingService
  userId: string
  locale?: 'ar' | 'en'
}): string {
  const locale = input.locale === 'ar' ? 'ar' : 'en'
  const trips = input.service.getActiveTrips(input.userId)
  const trip = trips[0] ?? input.service.listUserTrips(input.userId)[0] ?? null

  if (!trip) {
    return locale === 'ar'
      ? 'لا توجد رحلات محفوظة بعد. أكمل الحجز أولاً.'
      : 'I do not have a saved trip yet. Complete a booking first.'
  }

  switch (input.kind) {
    case 'my_trip':
      return formatMyTrip(trip, locale)
    case 'show_itinerary':
      return formatItinerary(trip, locale)
    case 'download_ticket':
      return formatTicket(trip, locale)
    case 'any_delays':
      return formatDelays(trip, locale)
    case 'what_hotel':
      return formatHotel(trip, locale)
  }
}

export function shouldHandleTripQueries(options?: {
  tripManagementEnabled?: boolean
}): boolean {
  return isTripManagementEnabled(options)
}

function formatMyTrip(trip: PostBookingTripRecord, locale: 'ar' | 'en'): string {
  if (locale === 'ar') {
    return [
      `رحلتك إلى ${trip.destination} (${trip.lifecycle}).`,
      `مرجع الحجز: ${trip.references.bookingReference}`,
      `المبلغ المدفوع: ${trip.totalPaid} ${trip.currency}`,
    ].join('\n')
  }
  return [
    `Your trip to ${trip.destination} is ${trip.lifecycle.toLowerCase()}.`,
    `Booking reference: ${trip.references.bookingReference}`,
    `Total paid: ${trip.totalPaid} ${trip.currency}`,
    trip.documents.bookingSummary.hotelName
      ? `Hotel: ${trip.documents.bookingSummary.hotelName}`
      : null,
  ]
    .filter(Boolean)
    .join('\n')
}

function formatItinerary(trip: PostBookingTripRecord, locale: 'ar' | 'en'): string {
  const days = trip.documents.itinerary.days
    .map((d) => `Day ${d.day}: ${d.title} — ${d.items.join('; ')}`)
    .join('\n')
  if (locale === 'ar') {
    return `جدول رحلتك إلى ${trip.destination}:\n${days}\n\nPDF: ${trip.documents.pdfItinerary.pdfUri}`
  }
  return [
    `Here is your itinerary for ${trip.destination}:`,
    days,
    '',
    `PDF itinerary: ${trip.documents.pdfItinerary.pdfUri}`,
    trip.documents.itinerary.summaryText,
  ].join('\n')
}

function formatTicket(trip: PostBookingTripRecord, locale: 'ar' | 'en'): string {
  const ticket = trip.documents.eTicket
  if (!ticket) {
    return locale === 'ar'
      ? 'لا توجد تذكرة إلكترونية لهذه الرحلة.'
      : 'There is no e-ticket on file for this trip.'
  }
  if (locale === 'ar') {
    return `تذكرتك: ${ticket.flightConfirmation}\nتحميل: ${ticket.pdfUri}`
  }
  return [
    `Your e-ticket confirmation is ${ticket.flightConfirmation}.`,
    `Download: ${ticket.pdfUri}`,
    trip.documents.boardingPass
      ? `Boarding pass: gate ${trip.documents.boardingPass.gate}, seat ${trip.documents.boardingPass.seat}`
      : null,
  ]
    .filter(Boolean)
    .join('\n')
}

function formatDelays(trip: PostBookingTripRecord, locale: 'ar' | 'en'): string {
  const status = trip.flightStatus
  if (!status) {
    return locale === 'ar'
      ? 'لم يتم تحديث حالة الرحلة بعد. اطلب التحقق من التأخيرات.'
      : 'I have not checked live flight status yet. Ask me again after a status refresh.'
  }
  if (locale === 'ar') {
    return status.message
  }
  return status.message
}

function formatHotel(trip: PostBookingTripRecord, locale: 'ar' | 'en'): string {
  const voucher = trip.documents.hotelVoucher
  const name = trip.hotelName ?? voucher?.hotelName
  if (!name) {
    return locale === 'ar'
      ? 'لا يوجد فندق مرتبط بهذه الرحلة.'
      : 'There is no hotel linked to this trip.'
  }
  if (locale === 'ar') {
    return `أنت مقيم في ${name}${voucher ? ` (تأكيد ${voucher.confirmationNumber})` : ''}.`
  }
  return [
    `You are staying at ${name}.`,
    voucher ? `Voucher confirmation: ${voucher.confirmationNumber}` : null,
    voucher ? `Download voucher: ${voucher.pdfUri}` : null,
  ]
    .filter(Boolean)
    .join('\n')
}
