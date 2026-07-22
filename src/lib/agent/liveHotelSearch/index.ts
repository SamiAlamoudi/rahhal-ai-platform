/**
 * Sprint 109 — Live Hotel Search (Amadeus via Provider Gateway).
 */

export {
  SPRINT109_LIVE_HOTEL_SEARCH_VERSION,
  type LiveHotelRankKind,
  type LiveHotelSearchCriteria,
  type HotelOffer,
  type LiveHotelRankedGroup,
  type LiveHotelSearchError,
  type LiveHotelSearchLogEntry,
  type LiveHotelSearchResult,
  type LiveHotelSearchStructuredLogger,
  createSilentLiveHotelSearchLogger,
} from './types'

export {
  LIVE_HOTEL_SEARCH_FEATURE_ID,
  isLiveHotelSearchEnabled,
} from './feature'

export {
  validateLiveHotelSearchCriteria,
  type LiveHotelSearchValidation,
} from './LiveHotelSearchValidator'

export {
  LiveHotelSearchComposer,
  createLiveHotelSearchComposer,
  composeLiveHotelSearchRequest,
  type LiveHotelSearchComposeResult,
} from './LiveHotelSearchComposer'

export {
  LiveHotelSearchMapper,
  createLiveHotelSearchMapper,
  mapGatewayOfferToHotelOffer,
  mapGatewayResponseToLiveHotelSearch,
  mapGatewayError,
  toDecisionEngineHotelRecord,
  rankHotelOffers,
} from './LiveHotelSearchMapper'

export {
  LiveHotelSearchMetrics,
  createLiveHotelSearchMetrics,
  type LiveHotelSearchMetricsSnapshot,
} from './LiveHotelSearchMetrics'

export {
  LiveHotelSearchRunner,
  createLiveHotelSearchRunner,
  runLiveHotelSearch,
  type LiveHotelSearchRunnerOptions,
} from './LiveHotelSearchRunner'
