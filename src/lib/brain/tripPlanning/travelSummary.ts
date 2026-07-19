import type { PlanningField, PlanningSession, TravelSummary } from './types'
import {
  PLANNING_REQUIRED,
  isPlanningFieldFilled,
  planningCompleteness,
} from './missingDetector'

const ALL_SUMMARY_FIELDS: PlanningField[] = [
  'destination',
  'departureCity',
  'travelDates',
  'travelerCount',
  'budget',
  'cabinClass',
  'airlinePreferences',
  'hotelPreferences',
  'roomRequirements',
  'transportation',
  'activities',
  'notes',
]

/**
 * Build a TravelSummary from the current PlanningSession.
 */
export function buildTravelSummary(session: PlanningSession): TravelSummary {
  const knownSlots = ALL_SUMMARY_FIELDS.filter((f) => isPlanningFieldFilled(session, f))
  const missingSlots = PLANNING_REQUIRED.filter((f) => !isPlanningFieldFilled(session, f))
  const completeness = planningCompleteness(session)
  const locale = session.locale
  const bullets: string[] = []

  if (session.destination) {
    bullets.push(
      locale === 'ar' ? `الوجهة: ${session.destination}` : `Destination: ${session.destination}`,
    )
  }
  if (session.departureCity) {
    bullets.push(
      locale === 'ar'
        ? `المغادرة: ${session.departureCity}`
        : `Departure: ${session.departureCity}`,
    )
  }
  if (session.travelDates.durationDays != null) {
    bullets.push(
      locale === 'ar'
        ? `المدة: ${session.travelDates.durationDays} أيام`
        : `Duration: ${session.travelDates.durationDays} days`,
    )
  } else if (session.travelDates.startDate) {
    bullets.push(
      locale === 'ar'
        ? `التواريخ: ${session.travelDates.startDate}${session.travelDates.endDate ? ` → ${session.travelDates.endDate}` : ''}`
        : `Dates: ${session.travelDates.startDate}${session.travelDates.endDate ? ` → ${session.travelDates.endDate}` : ''}`,
    )
  } else if (session.flexibility || session.travelDates.flexible) {
    bullets.push(locale === 'ar' ? 'تواريخ مرنة' : 'Flexible dates')
  }
  if (session.travelerCount != null || session.adults != null) {
    const a = session.adults ?? session.travelerCount ?? 0
    const c = session.children ?? 0
    const i = session.infants ?? 0
    bullets.push(
      locale === 'ar'
        ? `المسافرون: ${a} بالغ / ${c} طفل / ${i} رضيع`
        : `Travelers: ${a} adults / ${c} children / ${i} infants`,
    )
  }
  if (session.budget.amount != null) {
    bullets.push(
      locale === 'ar'
        ? `الميزانية: ${session.budget.amount} ${session.budget.currency ?? 'SAR'}`
        : `Budget: ${session.budget.amount} ${session.budget.currency ?? 'SAR'}`,
    )
  }
  if (session.cabinClass) {
    bullets.push(locale === 'ar' ? `الدرجة: ${session.cabinClass}` : `Cabin: ${session.cabinClass}`)
  }
  if (session.airlinePreferences.length) {
    bullets.push(
      locale === 'ar'
        ? `الطيران: ${session.airlinePreferences.join(', ')}`
        : `Airlines: ${session.airlinePreferences.join(', ')}`,
    )
  }
  if (session.hotelPreferences.length) {
    bullets.push(
      locale === 'ar'
        ? `الفندق: ${session.hotelPreferences.join(', ')}`
        : `Hotels: ${session.hotelPreferences.join(', ')}`,
    )
  }

  const headline =
    completeness >= 1
      ? locale === 'ar'
        ? `خطة سفر جاهزة إلى ${session.destination ?? 'وجهتك'}`
        : `Trip plan ready for ${session.destination ?? 'your destination'}`
      : locale === 'ar'
        ? 'ملخص التخطيط حتى الآن'
        : 'Planning summary so far'

  return {
    headline,
    bullets,
    completeness,
    knownSlots,
    missingSlots,
  }
}
