import type { TravelIntentId } from '../intent/intents'
import type { TravelDraft } from '../travel/types'
import type { BrainErrorCode } from '../types'

export type SafetyVerdict = {
  status: 'ok' | 'clarify' | 'block'
  code?: BrainErrorCode
  message: string
  missingFields: string[]
}

const REQUIRED_BY_INTENT: Partial<Record<TravelIntentId, (keyof TravelDraft)[]>> = {
  book_flight: ['origin', 'destination'],
  book_hotel: ['destination'],
  book_package: ['destination'],
  visa: ['visaCountry'],
  weather: ['destination'],
  budget_planning: ['destination'],
  price_prediction: ['destination'],
  cancel_booking: [],
  modify_trip: [],
  emergency: [],
}

/**
 * Polite safety gates for missing, ambiguous, impossible, contradictory requests.
 */
export class SafetyLayer {
  assess(input: {
    text: string
    intentId: TravelIntentId
    intentConfidence: number
    draft: TravelDraft
  }): SafetyVerdict {
    const missingFields: string[] = []
    const required = REQUIRED_BY_INTENT[input.intentId] ?? []
    for (const field of required) {
      if (input.draft[field] == null || input.draft[field] === '') missingFields.push(String(field))
    }

    if (input.draft.origin && input.draft.destination) {
      if (input.draft.origin.toLowerCase() === input.draft.destination.toLowerCase()) {
        return {
          status: 'block',
          code: 'impossible_itinerary',
          message:
            'That itinerary is not possible — origin and destination are the same. Shall we pick another city?',
          missingFields: [],
        }
      }
    }

    if (
      input.draft.budgetAmount != null &&
      input.draft.hotelClass != null &&
      input.draft.budgetAmount < 400 &&
      input.draft.hotelClass >= 5 &&
      (input.draft.durationNights ?? 1) >= 3
    ) {
      return {
        status: 'block',
        code: 'contradictory_request',
        message:
          'A multi-night five-star stay conflicts with this budget. We can soften the hotel class or raise the budget — which do you prefer?',
        missingFields: [],
      }
    }

    if (input.intentConfidence > 0 && input.intentConfidence < 0.5) {
      return {
        status: 'clarify',
        code: 'ambiguous_request',
        message: 'I want to be sure I help correctly — are you looking to book, explore, or get advice?',
        missingFields,
      }
    }

    if (/\bmaybe\b.*\bor\b|\bأو\b.*\bأو\b|مش متأكد|لست متأكد/i.test(input.text) && input.intentId === 'unknown') {
      return {
        status: 'clarify',
        code: 'ambiguous_request',
        message: 'Happy to help either way — would you like flight options, hotels, or a full package?',
        missingFields,
      }
    }

    if (missingFields.length > 0) {
      return {
        status: 'clarify',
        code: 'missing_information',
        message: `To continue, I still need: ${missingFields.join(', ')}.`,
        missingFields,
      }
    }

    return { status: 'ok', message: 'Safe to proceed.', missingFields: [] }
  }
}
