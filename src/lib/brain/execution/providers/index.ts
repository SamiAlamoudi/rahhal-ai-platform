/**
 * Sprint 23 — provider abstractions (interfaces only; no live Amadeus/Booking/etc.).
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

export function createMockExecutionProviders(): ExecutionProviderBundle {
  return {
    flights: createMockFlightProvider(),
    hotels: createMockHotelProvider(),
    transport: createMockTransportProvider(),
    activities: createMockActivitiesProvider(),
    packages: createMockPackageProvider(),
  }
}
