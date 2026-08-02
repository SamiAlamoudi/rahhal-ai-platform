import type { TravelIntentId } from '../intent/intents'

/**
 * Tool catalog — identifiers only. No runtime provider integrations.
 */
export const BRAIN_TOOLS = [
  'search_flights_mock',
  'search_hotels_mock',
  'search_packages_mock',
  'destination_lookup_mock',
  'visa_info_mock',
  'weather_lookup_mock',
  'budget_estimate_mock',
  'price_predict_mock',
  'modify_trip_mock',
  'cancel_booking_mock',
  'recommend_mock',
  'transport_lookup_mock',
  'restaurant_lookup_mock',
  'activities_lookup_mock',
  'emergency_assist_mock',
  'travel_advice_mock',
  'clarify_user',
  'noop',
] as const

export type BrainToolId = (typeof BRAIN_TOOLS)[number]

export const INTENT_TOOL_MAP: Record<TravelIntentId, BrainToolId> = {
  book_flight: 'search_flights_mock',
  book_hotel: 'search_hotels_mock',
  book_package: 'search_packages_mock',
  search_destination: 'destination_lookup_mock',
  visa: 'visa_info_mock',
  weather: 'weather_lookup_mock',
  budget_planning: 'budget_estimate_mock',
  price_prediction: 'price_predict_mock',
  modify_trip: 'modify_trip_mock',
  cancel_booking: 'cancel_booking_mock',
  recommendations: 'recommend_mock',
  transportation: 'transport_lookup_mock',
  restaurants: 'restaurant_lookup_mock',
  activities: 'activities_lookup_mock',
  emergency: 'emergency_assist_mock',
  travel_advice: 'travel_advice_mock',
  unknown: 'clarify_user',
}
