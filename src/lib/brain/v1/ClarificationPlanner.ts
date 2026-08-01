/**
 * Sprint 81 — ClarificationPlanner (Brain v1).
 * Ask only the minimum required question — never a form dump.
 */

import type {
  BrainV1Clarification,
  BrainV1Entities,
  BrainV1Intent,
  BrainV1MissingField,
} from './types'

const QUESTIONS: Record<BrainV1MissingField, { ar: string; en: string }> = {
  destination: {
    ar: 'إلى أين تود السفر؟',
    en: 'Where would you like to travel?',
  },
  origin: {
    ar: 'من أي مدينة ستسافر؟',
    en: 'Which city will you depart from?',
  },
  travel_dates: {
    ar: 'متى تود السفر؟',
    en: 'When would you like to travel?',
  },
  travelers: {
    ar: 'كم عدد المسافرين؟',
    en: 'How many travelers?',
  },
  budget: {
    ar: 'ما هي ميزانيتك تقريباً؟',
    en: 'What is your approximate budget?',
  },
  cabin: {
    ar: 'هل تفضل الدرجة السياحية أم رجال الأعمال؟',
    en: 'Do you prefer economy or business class?',
  },
  hotel_rating: {
    ar: 'ما الحد الأدنى لتقييم الفندق الذي تفضله؟',
    en: 'What minimum hotel rating do you prefer?',
  },
}

export class ClarificationPlanner {
  detectMissing(intent: BrainV1Intent, entities: BrainV1Entities): BrainV1MissingField[] {
    const missing: BrainV1MissingField[] = []

    const needsTrip =
      intent === 'flight_search'
      || intent === 'hotel_search'
      || intent === 'package_search'
      || intent === 'multi_city_trip'
      || intent === 'business_travel'
      || intent === 'family_vacation'
      || intent === 'weekend_trip'
      || intent === 'price_comparison'

    if (!needsTrip) return missing

    if (!entities.destination) missing.push('destination')
    if (
      (intent === 'flight_search' || intent === 'package_search' || intent === 'multi_city_trip')
      && !entities.origin
    ) {
      missing.push('origin')
    }
    if (!entities.travelDates.start && !entities.flexibleDates) {
      missing.push('travel_dates')
    }
    if (entities.travelerCount == null && entities.adults == null) {
      // Only ask travelers after destination + dates are known (minimum path).
      if (entities.destination && (entities.travelDates.start || entities.flexibleDates)) {
        missing.push('travelers')
      }
    }
    return missing
  }

  /** Return at most one clarification question. */
  plan(
    intent: BrainV1Intent,
    entities: BrainV1Entities,
  ): { missing: BrainV1MissingField[]; clarifications: BrainV1Clarification[] } {
    const missing = this.detectMissing(intent, entities)
    if (missing.length === 0) return { missing, clarifications: [] }
    const field = missing[0]!
    const q = QUESTIONS[field]
    return {
      missing,
      clarifications: [{
        field,
        questionAr: q.ar,
        questionEn: q.en,
        required: true,
      }],
    }
  }
}

export function createClarificationPlanner(): ClarificationPlanner {
  return new ClarificationPlanner()
}
