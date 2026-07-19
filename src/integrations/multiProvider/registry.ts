/**
 * Multi Provider Registry — ordered supplier chains per travel domain.
 */

import type { MultiProviderAdapter, MultiProviderId, TravelDomain } from './types'
import { PROVIDER_CATALOG } from './types'
import { getDomainChain, getMultiProviderConfig } from './config'
import { createPreparedAdapter } from './adapters/preparedAdapter'
import {
  createAmadeusEnterpriseFlightAdapter,
  createBookingHotelAdapter,
  createMockDomainAdapter,
  createRentalCarsAdapter,
} from './adapters/liveWrappers'

export interface MultiProviderRegistry {
  getChain(domain: TravelDomain): MultiProviderAdapter[]
  getAdapter(domain: TravelDomain, id: MultiProviderId): MultiProviderAdapter | null
  listCatalog(): typeof PROVIDER_CATALOG
  getConfiguredOrder(domain: TravelDomain): MultiProviderId[]
  register(adapter: MultiProviderAdapter): void
}

function buildDefaultAdapters(): MultiProviderAdapter[] {
  return [
    // Flights — prepared GDS slots + Amadeus Enterprise live wrapper + mock
    createPreparedAdapter({
      id: 'duffel',
      displayName: 'Duffel',
      domains: ['flight'],
      errorMessage: 'Duffel API credentials are not configured (prepared adapter)',
    }),
    createPreparedAdapter({
      id: 'travelport',
      displayName: 'Travelport',
      domains: ['flight'],
      errorMessage: 'Travelport API credentials are not configured (prepared adapter)',
    }),
    createPreparedAdapter({
      id: 'sabre',
      displayName: 'Sabre',
      domains: ['flight'],
      errorMessage: 'Sabre API credentials are not configured (prepared adapter)',
    }),
    createAmadeusEnterpriseFlightAdapter(),
    createPreparedAdapter({
      id: 'amadeus',
      displayName: 'Amadeus',
      domains: ['flight'],
      errorMessage: 'Use amadeus_enterprise slot for live Amadeus Self-Service / Enterprise',
    }),

    // Hotels
    createBookingHotelAdapter(),
    createPreparedAdapter({
      id: 'expedia',
      displayName: 'Expedia',
      domains: ['hotel'],
    }),
    createPreparedAdapter({
      id: 'hotelbeds',
      displayName: 'Hotelbeds',
      domains: ['hotel'],
    }),

    // Cars
    createRentalCarsAdapter(),

    // Activities
    createPreparedAdapter({
      id: 'viator',
      displayName: 'Viator',
      domains: ['activities'],
    }),
    createPreparedAdapter({
      id: 'getyourguide',
      displayName: 'GetYourGuide',
      domains: ['activities'],
    }),

    // Domain-specific mock terminals
    createMockDomainAdapter('flight'),
    createMockDomainAdapter('hotel'),
    createMockDomainAdapter('cars'),
    createMockDomainAdapter('activities'),
    createMockDomainAdapter('transfers'),
  ]
}

export function createMultiProviderRegistry(
  adapters: MultiProviderAdapter[] = buildDefaultAdapters(),
): MultiProviderRegistry {
  const byKey = new Map<string, MultiProviderAdapter>()

  function register(adapter: MultiProviderAdapter): void {
    for (const domain of adapter.domains) {
      byKey.set(`${domain}:${adapter.id}`, adapter)
    }
    // Also allow lookup when adapter declares multiple domains via id alone for mock.
    if (adapter.domains.length > 1) {
      byKey.set(`*:${adapter.id}`, adapter)
    }
  }

  for (const adapter of adapters) register(adapter)

  return {
    register,

    getConfiguredOrder(domain: TravelDomain): MultiProviderId[] {
      return getDomainChain(domain)
    },

    getAdapter(domain: TravelDomain, id: MultiProviderId): MultiProviderAdapter | null {
      return byKey.get(`${domain}:${id}`) ?? byKey.get(`*:${id}`) ?? null
    },

    getChain(domain: TravelDomain): MultiProviderAdapter[] {
      const order = getDomainChain(domain)
      const chain: MultiProviderAdapter[] = []
      for (const id of order) {
        const adapter = byKey.get(`${domain}:${id}`) ?? byKey.get(`*:${id}`)
        if (adapter) chain.push(adapter)
      }
      return chain
    },

    listCatalog() {
      return PROVIDER_CATALOG
    },
  }
}

let sharedRegistry: MultiProviderRegistry | null = null

export function getMultiProviderRegistry(): MultiProviderRegistry {
  if (!sharedRegistry) {
    // Touch config so chains are resolved.
    getMultiProviderConfig()
    sharedRegistry = createMultiProviderRegistry()
  }
  return sharedRegistry
}

export function resetMultiProviderRegistry(): void {
  sharedRegistry = null
}
