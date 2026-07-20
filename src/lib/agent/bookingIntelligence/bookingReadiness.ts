/**
 * Booking readiness — decide if enough information exists to recommend/book.
 * Returns at most one highest-priority clarification.
 */

import type { TripRequirements } from '../types'
import type { BookingReadinessResult } from './types'

const PRIORITY: Array<keyof TripRequirements | string> = [
  'destination',
  'startDate',
  'durationDays',
  'travelers',
  'budgetAmount',
]

export function assessBookingReadiness(input: {
  requirements: TripRequirements
  missingFields: Array<keyof TripRequirements | string>
  locale?: 'ar' | 'en'
  hasRankedOffers?: boolean
}): BookingReadinessResult {
  const criticalMissing = PRIORITY.filter((field) => {
    if (field === 'destination') {
      if (input.requirements.destinationFlexible) return false
      return !input.requirements.destination && input.requirements.destinations.length === 0
    }
    if (field === 'startDate') {
      // Timing is satisfied by an explicit start date OR a duration.
      if (input.requirements.startDate) return false
      if (input.requirements.durationDays != null) return false
      if (input.requirements.startDate && input.requirements.endDate) return false
      return true
    }
    if (field === 'durationDays') {
      return input.requirements.durationDays == null
        && !(input.requirements.startDate && input.requirements.endDate)
    }
    if (field === 'travelers') {
      return input.requirements.travelers == null
    }
    if (field === 'budgetAmount') {
      return input.requirements.budgetAmount == null && !input.requirements.budgetFlexible
    }
    return input.missingFields.map(String).includes(String(field))
  }).map(String)

  if (criticalMissing.length === 0 && input.hasRankedOffers !== false) {
    return {
      bookingReady: true,
      missingFields: [],
      clarification: null,
      priorityField: null,
    }
  }

  const priorityField = criticalMissing[0] ?? null
  return {
    bookingReady: false,
    missingFields: criticalMissing,
    clarification: priorityField
      ? clarificationFor(priorityField, input.locale ?? 'en')
      : null,
    priorityField,
  }
}

function clarificationFor(field: string, locale: 'ar' | 'en'): string {
  if (locale === 'ar') {
    switch (field) {
      case 'destination': return 'ما هي الوجهة التي تخطط لها؟'
      case 'startDate': return 'متى تود السفر؟'
      case 'durationDays': return 'كم يومًا تقريبًا؟'
      case 'travelers': return 'كم عدد المسافرين؟'
      case 'budgetAmount': return 'ما هي ميزانيتك التقريبية؟'
      default: return 'هل يمكنك توضيح تفصيلة واحدة مهمة؟'
    }
  }
  switch (field) {
    case 'destination': return 'Which destination are you planning for?'
    case 'startDate': return 'When would you like to travel?'
    case 'durationDays': return 'Roughly how many days?'
    case 'travelers': return 'How many travelers?'
    case 'budgetAmount': return 'What is your approximate budget?'
    default: return 'Could you clarify one key detail?'
  }
}
