/**
 * Sprint 23–26 — provider abstractions (mock + real adapters).
 */

import type { ExecutionProviderBundle } from '../types'
import {
  createMockActivitiesProvider,
  createMockFlightProvider,
  createMockHotelProvider,
  createMockPackageProvider,
  createMockTransportProvider,
} from './mockProviders'

export type {
  FlightProvider,
  HotelProvider,
  TransportProvider,
  ActivitiesProvider,
  PackageProvider,
  ActivityProvider,
  ExecutionProviderBundle,
  ProviderSearchContext,
} from '../types'

export {
  createMockFlightProvider,
  createMockHotelProvider,
  createMockTransportProvider,
  createMockActivitiesProvider,
  createMockPackageProvider,
} from './mockProviders'

export {
  resolveExecutionProviderConfig,
  type ExecutionProviderRuntimeConfig,
  type ExecutionProviderMode,
  type ExecutionProviderDomain,
  type DomainProviderConfig,
  type ProviderHealthStatus,
  type ResolveExecutionProviderConfigInput,
} from './config'

export {
  TtlCache,
  getProviderCache,
  clearAllProviderCaches,
  buildProviderCacheKey,
  type ProviderCacheKind,
} from './cache'

export {
  recordProviderSample,
  getProviderMonitorSnapshot,
  listProviderMonitorSnapshots,
  resetProviderMonitoring,
  type ProviderMonitorSample,
  type ProviderMonitorSnapshot,
} from './monitoring'

export { withProviderResilience } from './resilience'

export {
  createExecutionProviders,
  type CreateExecutionProvidersOptions,
  type CreateExecutionProvidersResult,
} from './createExecutionProviders'

export { createAmadeusFlightExecutionProvider } from './real/amadeusFlightProvider'
export { createBookingHotelExecutionProvider } from './real/bookingHotelProvider'
export {
  createMapsTransportExecutionProvider,
  createRealActivitiesExecutionProvider,
  createRealActivityExecutionProvider,
  createRealPackageExecutionProvider,
} from './real/shapedProviders'

export function createMockExecutionProviders(): ExecutionProviderBundle {
  return {
    flights: createMockFlightProvider(),
    hotels: createMockHotelProvider(),
    transport: createMockTransportProvider(),
    activities: createMockActivitiesProvider(),
    packages: createMockPackageProvider(),
  }
}
