/**
 * Visual itinerary timeline — modular for future dynamic updates.
 */

import type { BookingRecord } from '../booking/bookingRecord'
import { recommendLeaveForAirport } from './timeHelpers'
import type { TimelineItem } from './types'

export function buildItineraryTimeline(record: BookingRecord): TimelineItem[] {
  const flight = record.flight
  const dep = flight?.departureTime || null
  const arr = flight?.arrivalTime || null
  const leave = recommendLeaveForAirport(dep, flight?.stops ?? null)
  const dest = flight?.destination || 'destination'

  const items: TimelineItem[] = [
    {
      id: 'departure-prep',
      type: 'departure_prep',
      at: leave?.toISOString() ?? null,
      labelAr: 'الاستعداد للمغادرة',
      labelEn: 'Departure prep',
      detailAr: 'جهّز الوثائق والحقيبة قبل التوجه للمطار.',
      detailEn: 'Prepare documents and bags before heading to the airport.',
    },
    {
      id: 'airport-arrival',
      type: 'airport_arrival',
      at: leave?.toISOString() ?? null,
      labelAr: 'الوصول إلى المطار',
      labelEn: 'Airport arrival recommendation',
      detailAr: leave
        ? `يُفضّل الوصول حوالي ${leave.toLocaleString('ar-SA')}.`
        : 'احرص على الوصول قبل الإقلاع بوقت كافٍ.',
      detailEn: leave
        ? `Aim to arrive around ${leave.toLocaleString('en-US')}.`
        : 'Plan to arrive with enough time before departure.',
    },
    {
      id: 'flight-depart',
      type: 'flight_depart',
      at: dep,
      labelAr: 'إقلاع الرحلة',
      labelEn: 'Flight departure',
      detailAr: flight
        ? `${flight.airline} · ${flight.origin} → ${flight.destination}`
        : 'رحلة الذهاب',
      detailEn: flight
        ? `${flight.airline} · ${flight.origin} → ${flight.destination}`
        : 'Outbound flight',
    },
    {
      id: 'flight-arrive',
      type: 'flight_arrive',
      at: arr,
      labelAr: 'الهبوط',
      labelEn: 'Arrival',
      detailAr: `الوصول إلى ${dest}.`,
      detailEn: `Arrive in ${dest}.`,
    },
    {
      id: 'hotel-checkin',
      type: 'hotel_checkin',
      at: arr,
      labelAr: 'تسجيل الوصول للفندق',
      labelEn: 'Hotel check-in',
      detailAr: 'Placeholder — سيُربط بحجز الفندق لاحقاً.',
      detailEn: 'Placeholder — will link to hotel booking later.',
      placeholder: true,
    },
    {
      id: 'transport',
      type: 'transport',
      at: arr,
      labelAr: 'المواصلات',
      labelEn: 'Transportation',
      detailAr: 'Placeholder — تاكسي / قطار / تأجير سيارة.',
      detailEn: 'Placeholder — taxi / rail / car rental.',
      placeholder: true,
    },
    {
      id: 'daily-schedule',
      type: 'daily_schedule',
      at: arr,
      labelAr: 'الجدول اليومي',
      labelEn: 'Daily schedule',
      detailAr: 'راجع خطة الأيام أدناه — قابلة للتحديث ديناميكياً.',
      detailEn: 'See daily plans below — supports future dynamic updates.',
    },
    {
      id: 'return-flight',
      type: 'return_flight',
      at: null,
      labelAr: 'رحلة العودة',
      labelEn: 'Return flight',
      detailAr: 'Placeholder — عند توفر رحلة العودة في الحجز.',
      detailEn: 'Placeholder — when a return flight is on the booking.',
      placeholder: true,
    },
  ]

  return items
}
