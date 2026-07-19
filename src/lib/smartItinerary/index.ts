/**
 * Sprint 17 — Smart Itinerary AI Engine.
 * BookingSession remains SoT; TripItinerary references booking (+ optional order).
 */

export type {
  TripItinerary,
  DayPlan,
  DayPart,
  DayPartBlock,
  TravelInsight,
  TravelInsightKind,
  TimelineItem,
  TimelineEventType,
  TripSummary,
  ItineraryLocale,
  GenerateItineraryInput,
} from './types'

export {
  generateTripItinerary,
  getCachedItinerary,
  getOrGenerateItinerary,
  regenerateTripItinerary,
  clearItineraryCache,
  itineraryPath,
} from './engine'

export { buildItineraryTimeline } from './timeline'
export { buildDailyPlans } from './dailyPlanner'
export { buildTravelInsights } from './travelInsights'
export {
  flightDurationMinutes,
  formatDuration,
  recommendLeaveForAirport,
  airportArriveBeforeMinutes,
  tripDurationDays,
  parseIso,
} from './timeHelpers'

export {
  buildSmartItineraryConciergeReply,
  answerShowMyItinerary,
  answerTodaysPlan,
  answerWhenLeaveForAirport,
  answerSummarizeMyTrip,
} from './itineraryConcierge'
export type { SmartItineraryConciergeIntent } from './itineraryConcierge'
