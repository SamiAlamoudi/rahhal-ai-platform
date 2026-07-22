/**
 * Sprint 105 — Live Flight Search (Amadeus via Provider Gateway).
 */

export {
  SPRINT105_LIVE_FLIGHT_SEARCH_VERSION,
  type LiveFlightCabin,
  type LiveFlightSearchCriteria,
  type RahhalFlightSearchOffer,
  type LiveFlightSearchError,
  type LiveFlightSearchLogEntry,
  type LiveFlightSearchResult,
  type LiveFlightSearchStructuredLogger,
  createSilentLiveFlightSearchLogger,
} from './types'

export {
  LIVE_FLIGHT_SEARCH_FEATURE_ID,
  isLiveFlightSearchEnabled,
} from './feature'

export {
  validateLiveFlightSearchCriteria,
  type LiveFlightSearchValidation,
} from './LiveFlightSearchValidator'

export {
  LiveFlightSearchComposer,
  createLiveFlightSearchComposer,
  composeLiveFlightSearchRequest,
  type LiveFlightSearchComposeResult,
} from './LiveFlightSearchComposer'

export {
  LiveFlightSearchMapper,
  createLiveFlightSearchMapper,
  mapGatewayOfferToRahhalFlight,
  mapGatewayResponseToLiveFlightSearch,
  mapGatewayError,
  toDecisionEngineOfferRecord,
} from './LiveFlightSearchMapper'

export {
  LiveFlightSearchMetrics,
  createLiveFlightSearchMetrics,
  type LiveFlightSearchMetricsSnapshot,
} from './LiveFlightSearchMetrics'

export {
  LiveFlightSearchRunner,
  createLiveFlightSearchRunner,
  runLiveFlightSearch,
  type LiveFlightSearchRunnerOptions,
} from './LiveFlightSearchRunner'
