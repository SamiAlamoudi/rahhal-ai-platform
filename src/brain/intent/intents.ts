/**
 * Canonical travel intents for the AI Travel Brain foundation.
 */

export const TRAVEL_INTENT_IDS = [
  'book_flight',
  'book_hotel',
  'book_package',
  'search_destination',
  'visa',
  'weather',
  'budget_planning',
  'price_prediction',
  'modify_trip',
  'cancel_booking',
  'recommendations',
  'transportation',
  'restaurants',
  'activities',
  'emergency',
  'travel_advice',
  'unknown',
] as const

export type TravelIntentId = (typeof TRAVEL_INTENT_IDS)[number]

export type DetectedIntent = {
  id: TravelIntentId
  confidence: number
  locale: 'ar' | 'en'
  matchedSignals: string[]
}
