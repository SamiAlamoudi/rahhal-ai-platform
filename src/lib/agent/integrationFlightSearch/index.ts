/**
 * Integration Sprint 2 — Live Flight Search conversation bridge.
 * Feature-gated by existing `ai.live_flight_search` (default OFF).
 */

export { INTEGRATION_LIVE_FLIGHT_SEARCH_VERSION } from './types'
export type {
  ConversationFlightSearchResult,
  DepartureTimeWindow,
  FlightRankReason,
  FlightRankReasonCode,
  RankedConversationFlight,
} from './types'

export {
  ConversationFlightSearchCache,
  getConversationFlightSearchCache,
  resetConversationFlightSearchCache,
} from './cache'

export {
  normalizeCalendarDate,
  normalizeTravelerTimezone,
  departureHourUtc,
  windowFromHour,
} from './timezone'

export {
  rankConversationFlights,
  scoreConversationFlight,
  type ConversationRankPrefs,
} from './rankingExplain'

export { buildConsultantFlightSummary, highlightLines } from './consultantSummary'

export {
  adultsFromContext,
  childrenFromContext,
  cabinFromRequirements,
  preferredAirlineFromContext,
  preferredDepartureFromContext,
  buildLiveCriteriaFromContext,
  buildEngineRequestFromContext,
  timezoneFromContext,
} from './criteriaFromContext'

export {
  tryConversationLiveFlightSearch,
  conversationResultToToolData,
  type ConversationFlightSearchDeps,
} from './conversationFlightSearch'

export { runConversationAwareFlightSearch } from './toolBridge'
