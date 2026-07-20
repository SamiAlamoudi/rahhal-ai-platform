/**
 * Sprint 53 — live provider registry (dependency inversion).
 */

import type { LiveDomain } from '../types'
import type { LiveProvider } from './contract'
import { createMockFlightProvider } from './mocks/flightMock'
import { createMockHotelProvider } from './mocks/hotelMock'
import {
  createMockEventProvider,
  createMockExchangeProvider,
  createMockPriceWatchProvider,
  createMockSafetyProvider,
  createMockTransportProvider,
  createMockVisaProvider,
  createMockWeatherProvider,
} from './mocks'

export function createDefaultLiveProviders(): LiveProvider[] {
  return [
    createMockFlightProvider(),
    createMockHotelProvider(),
    createMockWeatherProvider(),
    createMockVisaProvider(),
    createMockEventProvider(),
    createMockSafetyProvider(),
    createMockExchangeProvider(),
    createMockTransportProvider(),
    createMockPriceWatchProvider(),
  ]
}

export function providersForDomains(
  providers: LiveProvider[],
  domains: LiveDomain[],
): LiveProvider[] {
  const set = new Set(domains)
  return providers.filter((p) => set.has(p.metadata().domain))
}

export type { LiveProvider, LiveProviderMetadata } from './contract'
