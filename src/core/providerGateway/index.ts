/**
 * Sprint 104 — Live Provider Gateway barrel.
 * Named exports avoid collisions with Sprint 90 ProviderRegistry / metrics.
 */

export {
  SPRINT104_PROVIDER_GATEWAY_VERSION,
  type GatewayProviderId,
  type GatewayOperation,
  type GatewayProviderStatus,
  type GatewayProviderDescriptor,
  type GatewayFlightSearchInput,
  type GatewayHotelSearchInput,
  type GatewayPackageSearchInput,
  type GatewayRequest,
  type GatewayOffer,
  type GatewayErrorView,
  type GatewayResponse,
  type GatewayLogEntry,
  type GatewayStructuredLogger,
  createSilentGatewayLogger,
  createCollectingGatewayLogger,
} from './types'

export {
  GatewayProviderRegistry,
  createGatewayProviderRegistry,
  PHASE1_DESCRIPTORS,
  type GatewayRegisteredProvider,
} from './ProviderRegistry'

export {
  ProviderHealthMonitor,
  createProviderHealthMonitor,
  type GatewayHealthSnapshot,
} from './ProviderHealthMonitor'

export {
  checkRegistryAvailability,
  detectProviderAvailability,
  type ProviderAvailabilityReport,
  type ProviderAvailabilityCheck,
} from './ProviderAvailability'

export {
  buildGatewayFlightRequest,
  buildGatewayHotelRequest,
  buildGatewayPackageRequest,
  buildProviderRequest,
  type BuiltProviderRequest,
} from './ProviderRequestBuilder'

export { mapProviderSearchResult } from './ProviderResponseMapper'

export {
  translateProviderError,
  translateOutcomeError,
} from './ProviderErrorTranslator'

export {
  GatewayMetrics,
  createGatewayMetrics,
  type GatewayMetricsRecord,
} from './ProviderMetrics'

export {
  createProviderGateway,
  executeAmadeusFlightSearch,
  type ProviderGateway,
  type ProviderGatewayOptions,
} from './ProviderGateway'
