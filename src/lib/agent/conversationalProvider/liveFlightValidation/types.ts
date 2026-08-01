/**
 * Sprint 80 P2 — End-to-end live flight validation contracts.
 */

export const LIVE_FLIGHT_P2_VALIDATION_VERSION = '1.0.0-live-flight-p2-validation'

export type LiveFlightValidationMode = 'mock' | 'live' | 'skipped'

export type FieldIntegrityStatus = 'present' | 'missing' | 'null' | 'invalid' | 'n/a'

export type FieldIntegrityReport = {
  authentication: FieldIntegrityStatus
  tokenRefresh: FieldIntegrityStatus
  requestMapping: FieldIntegrityStatus
  responseNormalization: FieldIntegrityStatus
  pricingIntegrity: FieldIntegrityStatus
  carrierData: FieldIntegrityStatus
  baggage: FieldIntegrityStatus
  fareFamilies: FieldIntegrityStatus
  cabinClasses: FieldIntegrityStatus
}

export type LatencyBreakdown = {
  /** Provider / runLive wall time (ms). */
  providerResponseMs: number
  /** Request map + response normalize wall time (ms). */
  normalizationMs: number
  /** Total pilot search duration (ms). */
  totalSearchMs: number
  /** Legacy baseline duration (ms). */
  legacySearchMs: number
}

export type ValidationTelemetryRates = {
  searches: number
  successes: number
  failures: number
  successRate: number
  timeoutRate: number
  authFailureRate: number
  emptyResponseRate: number
  providerErrorRate: number
  fallbackRate: number
}

export type OfferDiff = {
  path: string
  pilot: unknown
  legacy: unknown
  severity: 'info' | 'warn' | 'error'
  note: string
}

export type LiveFlightValidationScenario = {
  id: string
  label: string
  origin: string
  destination: string
  departureDate: string
  returnDate: string | null
  adults: number
  children: number
  cabin: string
  currency: string
}

export type LiveFlightValidationResult = {
  version: string
  mode: LiveFlightValidationMode
  scenario: LiveFlightValidationScenario
  gate: {
    allowed: boolean
    deployTarget: string
    reason: string
    productionBlocked: boolean
  }
  pilot: {
    ok: boolean
    empty: boolean
    offerCount: number
    searchEngine: string | null
    usedLive: boolean | null
    sampleOffer: Record<string, unknown> | null
  }
  legacy: {
    ok: boolean
    empty: boolean
    offerCount: number
    searchEngine: string | null
    sampleOffer: Record<string, unknown> | null
  }
  fieldIntegrity: FieldIntegrityReport
  differences: OfferDiff[]
  latency: LatencyBreakdown
  telemetry: ValidationTelemetryRates
  auth: {
    tokenAcquired: boolean
    tokenRefreshed: boolean
    detail: string
  }
  liveSkippedReason: string | null
  generatedAt: string
}
