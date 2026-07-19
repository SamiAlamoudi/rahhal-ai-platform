/**
 * Travel Insight cards — architecture-ready (placeholders for live integrations).
 */

import type { BookingRecord } from '../booking/bookingRecord'
import {
  airportArriveBeforeMinutes,
  flightDurationMinutes,
  formatDuration,
  recommendLeaveForAirport,
} from './timeHelpers'
import type { TravelInsight } from './types'

export function buildTravelInsights(record: BookingRecord): TravelInsight[] {
  const flight = record.flight
  const duration = flightDurationMinutes(flight?.departureTime, flight?.arrivalTime)
  const leave = recommendLeaveForAirport(flight?.departureTime, flight?.stops ?? null)
  const bufferH = Math.round(airportArriveBeforeMinutes(flight?.stops ?? null) / 60 * 10) / 10

  return [
    {
      id: 'insight-airport',
      kind: 'airport_arrival',
      titleAr: 'توصية الوصول للمطار',
      titleEn: 'Airport arrival recommendation',
      bodyAr: leave
        ? `يُفضّل التواجد في المطار قبل الإقلاع بنحو ${bufferH} ساعة (حوالي ${leave.toLocaleString('ar-SA')}).`
        : `احرص على الوصول قبل الإقلاع بنحو ${bufferH} ساعة.`,
      bodyEn: leave
        ? `Be at the airport ~${bufferH}h before departure (around ${leave.toLocaleString('en-US')}).`
        : `Plan to arrive ~${bufferH}h before departure.`,
      architectureReady: true,
      tone: 'tip',
    },
    {
      id: 'insight-travel-time',
      kind: 'travel_time',
      titleAr: 'مدة الرحلة التقديرية',
      titleEn: 'Estimated travel time',
      bodyAr: `مدة الطيران: ${formatDuration(duration, 'ar')}.`,
      bodyEn: `Flight duration: ${formatDuration(duration, 'en')}.`,
      architectureReady: true,
      tone: 'info',
    },
    {
      id: 'insight-timezone',
      kind: 'timezone',
      titleAr: 'فرق التوقيت',
      titleEn: 'Time zone difference',
      bodyAr: 'Placeholder — سيُحسب من خرائط المناطق الزمنية لاحقاً.',
      bodyEn: 'Placeholder — will compute from timezone maps later.',
      architectureReady: true,
      tone: 'neutral',
    },
    {
      id: 'insight-packing',
      kind: 'packing',
      titleAr: 'تذكير الأمتعة',
      titleEn: 'Packing reminder',
      bodyAr: 'تحقق من جواز السفر والشاحن وأدوية السفر قبل المغادرة.',
      bodyEn: 'Check passport, charger, and travel meds before you leave.',
      architectureReady: true,
      tone: 'tip',
    },
    {
      id: 'insight-weather',
      kind: 'weather',
      titleAr: 'الطقس',
      titleEn: 'Weather',
      bodyAr: 'Placeholder — جاهز لربط مزوّد الطقس.',
      bodyEn: 'Placeholder — ready to wire the weather provider.',
      architectureReady: true,
      tone: 'neutral',
    },
    {
      id: 'insight-currency',
      kind: 'currency',
      titleAr: 'العملة',
      titleEn: 'Currency',
      bodyAr: `عملة الحجز: ${record.fare.currency}. أسعار الصرف قادمة لاحقاً.`,
      bodyEn: `Booking currency: ${record.fare.currency}. FX rates coming later.`,
      architectureReady: true,
      tone: 'info',
    },
    {
      id: 'insight-visa',
      kind: 'visa',
      titleAr: 'التأشيرة',
      titleEn: 'Visa',
      bodyAr: 'Placeholder — تحقق متطلبات التأشيرة حسب الجنسية لاحقاً.',
      bodyEn: 'Placeholder — visa rules by nationality later.',
      architectureReady: true,
      tone: 'warning',
    },
  ]
}
