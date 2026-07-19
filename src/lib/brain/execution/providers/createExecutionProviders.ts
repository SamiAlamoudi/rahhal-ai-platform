/**
 * Sprint 26 — createExecutionProviders (mock / real / mixed).
 */

import type { ExecutionProviderBundle } from '../types'
import {
  resolveExecutionProviderConfig,
  type ExecutionProviderRuntimeConfig,
  type ResolveExecutionProviderConfigInput,
} from './config'
import {
  createMockActivitiesProvider,
  createMockFlightProvider,
  createMockHotelProvider,
  createMockPackageProvider,
  createMockTransportProvider,
} from './mockProviders'
import { withProviderResilience } from './resilience'
import { createAmadeusFlightExecutionProvider } from './real/amadeusFlightProvider'
import { createBookingHotelExecutionProvider } from './real/bookingHotelProvider'
import {
  createMapsTransportExecutionProvider,
  createRealActivitiesExecutionProvider,
  createRealPackageExecutionProvider,
} from './real/shapedProviders'
import type { AggregationQuery, ProviderFetchResult } from '../../../agent/aggregation/types'

export type CreateExecutionProvidersOptions = ResolveExecutionProviderConfigInput & {
  /** Force FeatureRegistry brain.real_providers on/off. */
  brainRealProvidersEnabled?: boolean
  /** Injected Amadeus/Booking fetch results for tests (no live HTTP). */
  deps?: {
    amadeusSearch?: (query: AggregationQuery) => Promise<ProviderFetchResult>
    bookingSearch?: (query: AggregationQuery) => Promise<ProviderFetchResult>
  }
  /** Skip resilience cache (deterministic tests). */
  disableCache?: boolean
}

export type CreateExecutionProvidersResult = {
  providers: ExecutionProviderBundle
  config: ExecutionProviderRuntimeConfig
}

/**
 * Build an ExecutionProviderBundle from runtime config.
 * Preserves mocks; real adapters only when enabled + (configured or injected deps).
 */
export function createExecutionProviders(
  options: CreateExecutionProvidersOptions = {},
): CreateExecutionProvidersResult {
  const brainOn = options.brainRealProvidersEnabled === true
  const config = resolveExecutionProviderConfig({
    ...options,
    realProvidersEnabled:
      options.realProvidersEnabled ??
      (brainOn || options.mode === 'real' || options.mode === 'mixed'),
  })

  const mocks: ExecutionProviderBundle = {
    flights: createMockFlightProvider(),
    hotels: createMockHotelProvider(),
    transport: createMockTransportProvider(),
    activities: createMockActivitiesProvider(),
    packages: createMockPackageProvider(),
  }

  if (!config.realProvidersEnabled || config.mode === 'mock') {
    return { providers: mocks, config: { ...config, mode: 'mock', realProvidersEnabled: false } }
  }

  const useCache = options.disableCache !== true
  const cacheTtlMs = config.cacheTtlMs

  const flightsPrimary =
    config.domains.flights.preferReal
      ? createAmadeusFlightExecutionProvider({
          search: options.deps?.amadeusSearch,
        })
      : mocks.flights

  const hotelsPrimary =
    config.domains.hotels.preferReal
      ? createBookingHotelExecutionProvider({
          search: options.deps?.bookingSearch,
        })
      : mocks.hotels

  const transportPrimary =
    config.domains.transport.preferReal
      ? createMapsTransportExecutionProvider()
      : mocks.transport

  const activitiesPrimary =
    config.domains.activities.preferReal
      ? createRealActivitiesExecutionProvider()
      : mocks.activities

  const packagesPrimary =
    config.domains.packages.preferReal
      ? createRealPackageExecutionProvider()
      : mocks.packages

  const wrap = <T extends ExecutionProviderBundle[keyof ExecutionProviderBundle]>(
    domain: keyof ExecutionProviderBundle,
    primary: T,
    fallback: T,
  ): T =>
    withProviderResilience({
      domain,
      primary,
      fallback: config.mockFallback ? fallback : null,
      cacheTtlMs,
      useCache,
    }) as T

  const providers: ExecutionProviderBundle = {
    flights: wrap('flights', flightsPrimary, mocks.flights),
    hotels: wrap('hotels', hotelsPrimary, mocks.hotels),
    transport: wrap('transport', transportPrimary, mocks.transport),
    activities: wrap('activities', activitiesPrimary, mocks.activities),
    packages: wrap('packages', packagesPrimary, mocks.packages),
  }

  return { providers, config }
}
