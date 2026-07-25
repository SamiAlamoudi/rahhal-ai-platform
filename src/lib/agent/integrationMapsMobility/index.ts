/**
 * Integration Sprint 8 — Maps & Live Mobility barrel.
 * Feature-gated by `ai.integration_maps_mobility` (default OFF).
 */

export { INTEGRATION_MAPS_MOBILITY_VERSION } from './types'
export type {
  GeoCoordinates,
  MapPlace,
  MapProvider,
  MapsMobilityIntent,
  MapsMobilityResult,
  MobilityMode,
  MobilityRoute,
  MobilityRouteStep,
  NearbyPlace,
  SpatialContext,
} from './types'

export {
  INTEGRATION_MAPS_MOBILITY_FEATURE_ID,
  isIntegrationMapsLiveEnabled,
  isIntegrationMapsMobilityEnabled,
} from './feature'

export { MOCK_PLACES, findMockPlaces, haversineMeters } from './catalog'
export { MockMapProvider, createMockMapProvider } from './mockProvider'
export { LiveGoogleMapsProvider, createLiveGoogleMapsProvider } from './liveAdapter'

export {
  detectMapsMobilityIntent,
  detectMobilityMode,
  extractRouteEndpoints,
  isMapsMobilityAsk,
} from './intents'

export { resolvePlaces, toSpatialContext } from './spatial'
export { buildMapsMobilitySummary } from './consultant'

export {
  runMapsMobility,
  type MapsMobilityDeps,
  type RunMapsMobilityInput,
} from './engine'

export {
  enrichWithIntegrationMapsMobility,
  shouldRunMapsMobility,
  toMapsMobilityMeta,
} from './enrich'
