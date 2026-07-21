/**
 * Sprint 73 — Hotel Search Engine (production-ready).
 * Additive consumer of Provider Runtime — does not modify runtime, flights, or RahhalBrain.
 */

export type {
  HotelProviderId,
  HotelSortMode,
  HotelCoordinates,
  UnifiedHotel,
  HotelSearchFilters,
  HotelSearchRequest,
  HotelSearchDiagnostics,
  HotelSearchPage,
} from './types'

export { SPRINT73_HOTEL_SEARCH_VERSION } from './types'

export {
  normalizeHotelOffer,
  normalizeHotelOffers,
  enrichMockHotel,
} from './normalize'

export { scoreHotel, rankHotels } from './ranking'
export { dedupeHotels } from './dedupe'
export { applyHotelFilters } from './filters'
export { sortHotels } from './sort'
export {
  encodeHotelCursor,
  decodeHotelCursor,
  paginateHotels,
  type HotelCursorPayload,
} from './pagination'
export { searchHotelbedsFuture, type HotelbedsFutureResult } from './hotelbedsFuture'

export {
  createHotelSearchEngine,
  getDefaultHotelSearchEngine,
  resetDefaultHotelSearchEngine,
  type HotelSearchEngine,
  type HotelSearchEngineOptions,
} from './engine'
