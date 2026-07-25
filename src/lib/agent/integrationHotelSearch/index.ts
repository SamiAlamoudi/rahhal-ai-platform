/**
 * Integration Sprint 3 — Live Hotel Search conversation bridge.
 * Feature-gated by existing `ai.live_hotel_search` (default OFF).
 */

export { INTEGRATION_LIVE_HOTEL_SEARCH_VERSION } from './types'
export type {
  ConversationHotelSearchResult,
  HotelRankReason,
  HotelRankReasonCode,
  RankedConversationHotel,
} from './types'

export {
  ConversationHotelSearchCache,
  getConversationHotelSearchCache,
  resetConversationHotelSearchCache,
} from './cache'

export {
  rankConversationHotels,
  scoreConversationHotel,
  type ConversationHotelRankPrefs,
} from './rankingExplain'

export { buildConsultantHotelSummary, hotelHighlightLines } from './consultantSummary'

export {
  adultsFromHotelContext,
  childrenFromHotelContext,
  roomsFromHotelContext,
  nightsFromHotelContext,
  amenityFiltersFromContext,
  buildLiveHotelCriteriaFromContext,
  buildEngineHotelRequestFromContext,
} from './criteriaFromContext'

export {
  tryConversationLiveHotelSearch,
  conversationHotelResultToToolData,
  type ConversationHotelSearchDeps,
} from './conversationHotelSearch'

export { runConversationAwareHotelSearch } from './toolBridge'
