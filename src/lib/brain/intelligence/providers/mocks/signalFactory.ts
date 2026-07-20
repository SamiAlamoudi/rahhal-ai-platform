/**
 * Sprint 53 — shared factory for signal-style live providers.
 */

import type {
  AvailabilityResult,
  BookingResult,
  CancelResult,
  LiveDomain,
  LiveProviderHealth,
  LiveQuery,
  PricingResult,
  StatusResult,
} from '../../types'
import { circuitSnapshot } from '../../resilience'
import type { LiveProvider } from '../contract'
import { money } from '../mockUtils'

export function createSignalProvider<T>(input: {
  providerId: string
  domain: LiveDomain
  name: string
  search: (query: LiveQuery) => T
}): LiveProvider<T> {
  const { providerId, domain, name } = input
  return {
    metadata: () => ({
      providerId,
      domain,
      version: '1.0.0',
      name,
      mode: 'mock',
    }),
    search: (query) => input.search(query),
    availability() {
      return { available: true, units: 1, notes: null } satisfies AvailabilityResult
    },
    pricing(query) {
      return {
        price: money(0, query.currency ?? 'SAR'),
        taxes: money(0, query.currency ?? 'SAR'),
        total: money(0, query.currency ?? 'SAR'),
        fareClass: null,
        confidence: 0.9,
      } satisfies PricingResult
    },
    booking() {
      return {
        bookingId: `${domain.toUpperCase()}-N/A`,
        status: 'pending',
        message: `${name} does not create bookings`,
      } satisfies BookingResult
    },
    cancel(bookingId) {
      return {
        bookingId,
        cancelled: false,
        refund: null,
        message: 'Not applicable',
      } satisfies CancelResult
    },
    status(bookingId) {
      return {
        bookingId,
        status: 'n/a',
        details: {},
      } satisfies StatusResult
    },
    health(): LiveProviderHealth {
      const snap = circuitSnapshot(providerId)
      return {
        providerId,
        domain,
        healthy: snap.state !== 'open',
        circuitState: snap.state,
        lastError: snap.lastError,
        latencyMs: snap.lastLatencyMs,
      }
    },
  }
}
