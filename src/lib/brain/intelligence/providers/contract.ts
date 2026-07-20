/**
 * Sprint 53 — Live provider contract.
 * Future providers plug in without changing RahhalBrain.
 */

import type {
  AvailabilityResult,
  BookingResult,
  CancelResult,
  LiveDomain,
  LiveProviderHealth,
  LiveProviderId,
  LiveQuery,
  PricingResult,
  StatusResult,
} from '../types'

export interface LiveProviderMetadata {
  providerId: LiveProviderId
  domain: LiveDomain
  version: string
  name: string
  mode: 'mock' | 'live'
}

export interface LiveProvider<TSearch = unknown> {
  metadata(): LiveProviderMetadata
  /** May return a value synchronously (mocks) or a Promise (live HTTP). */
  search(query: LiveQuery): TSearch | Promise<TSearch>
  availability(query: LiveQuery, offerId: string): AvailabilityResult | Promise<AvailabilityResult>
  pricing(query: LiveQuery, offerId: string): PricingResult | Promise<PricingResult>
  booking(query: LiveQuery, offerId: string): BookingResult | Promise<BookingResult>
  cancel(bookingId: string): CancelResult | Promise<CancelResult>
  status(bookingId: string): StatusResult | Promise<StatusResult>
  health(): LiveProviderHealth
}
