export type {
  TravelDomain,
  MultiProviderId,
  FailoverReason,
  QuotaStatus,
  MultiProviderDescriptor,
  ProviderAttemptRecord,
  ProviderHealthSnapshot,
  DomainHealthSummary,
  MultiProviderHealthReport,
  ChainSearchResult,
  MultiProviderAdapter,
} from './types'

export {
  DEFAULT_FLIGHT_CHAIN,
  DEFAULT_HOTEL_CHAIN,
  DEFAULT_CARS_CHAIN,
  DEFAULT_ACTIVITIES_CHAIN,
  DEFAULT_TRANSFERS_CHAIN,
  PROVIDER_CATALOG,
} from './types'

export {
  getMultiProviderConfig,
  clearMultiProviderConfigCache,
  getDomainChain,
  type MultiProviderConfig,
} from './config'

export {
  classifyProviderError,
  classifyThrown,
  shouldFailover,
} from './classifyError'

export {
  ProviderHealthMonitor,
  getProviderHealthMonitor,
  resetProviderHealthMonitor,
} from './healthMonitor'

export {
  createMultiProviderRegistry,
  getMultiProviderRegistry,
  resetMultiProviderRegistry,
  type MultiProviderRegistry,
} from './registry'

export {
  executeProviderChain,
  type ExecuteChainOptions,
} from './chainExecutor'

export { createPreparedAdapter } from './adapters/preparedAdapter'
export {
  createAmadeusEnterpriseFlightAdapter,
  createBookingHotelAdapter,
  createRentalCarsAdapter,
  createMockDomainAdapter,
} from './adapters/liveWrappers'
