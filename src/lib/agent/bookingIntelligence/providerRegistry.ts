/**
 * Unified Booking Provider Registry — agent never imports provider implementations.
 */

import type {
  BookingProvider,
  BookingProviderDomain,
  BookingProviderRegistry,
} from './types'

const ALL_DOMAINS: BookingProviderDomain[] = [
  'flights',
  'hotels',
  'activities',
  'car_rental',
  'airport_transfer',
  'insurance',
  'visa',
]

export function createBookingProviderRegistry(
  initial: BookingProvider[] = [],
): BookingProviderRegistry {
  const byId = new Map<string, BookingProvider>()
  for (const provider of initial) byId.set(provider.providerId, provider)

  return {
    list() {
      return [...byId.values()]
    },
    listDomains() {
      return ALL_DOMAINS.slice()
    },
    get(providerId) {
      return byId.get(providerId)
    },
    forDomain(domain) {
      return [...byId.values()].filter((p) => p.domain === domain && p.isAvailable())
    },
    register(provider) {
      byId.set(provider.providerId, provider)
    },
    route(domain) {
      return this.forDomain(domain)
    },
  }
}

export function bookingProviderDomains(): readonly BookingProviderDomain[] {
  return ALL_DOMAINS
}
