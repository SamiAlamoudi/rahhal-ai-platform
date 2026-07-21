/**
 * Sprint 72 — Flight Search Engine (production-ready).
 * Additive consumer of Provider Runtime — does not modify runtime or RahhalBrain.
 */

export type {
  FlightTripType,
  FlightCabinClass,
  FlightSortMode,
  FlightLegRequest,
  UnifiedFlight,
  FlightSearchFilters,
  FlightSearchRequest,
  FlightSearchDiagnostics,
  FlightSearchPage,
} from './types'

export { SPRINT72_FLIGHT_SEARCH_VERSION } from './types'

export {
  normalizeFlightOffer,
  normalizeFlightOffers,
  enrichMockFlight,
} from './normalize'

export { scoreFlight, rankFlights, type RankPreferences } from './ranking'
export { dedupeFlights } from './dedupe'
export { applyFlightFilters } from './filters'
export { sortFlights } from './sort'
export {
  encodeFlightCursor,
  decodeFlightCursor,
  paginateFlights,
  type FlightCursorPayload,
} from './pagination'

export {
  createFlightSearchEngine,
  getDefaultFlightSearchEngine,
  resetDefaultFlightSearchEngine,
  type FlightSearchEngine,
  type FlightSearchEngineOptions,
} from './engine'
