/**
 * Sprint 56 / 60 — Live Travel Provider Layer
 *
 * Provider-agnostic SDK + Amadeus / Duffel / Booking.com adapters,
 * health monitor, rate limiter, smart cache, selection, secrets, metrics.
 *
 * Conversation Brain remains the only author of traveler-facing text.
 * Booking Intelligence ranks; Autonomous Agent orchestrates.
 * Providers return structured data only.
 */

export * from './types'
export * from './feature'
export * from './secrets'
export * from './cache'
export * from './rateLimiter'
export * from './health'
export * from './metrics'
export * from './oauth'
export * from './selection'
export * from './wrap'
export * from './bridge'
export * from './registry'
export * from './providerLog'
export { createAmadeusLiveProvider } from './adapters/amadeus'
export { createDuffelLiveProvider } from './adapters/duffel'
export {
  createBookingLiveProvider,
  normalizeBookingHotel,
  BookingProviderError,
} from './adapters/booking'
