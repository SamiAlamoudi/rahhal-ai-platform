/**
 * Sprint 80 P1-4 — Live Flight Provider Pilot unit tests.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import {
  AMADEUS_LIVE_FLIGHT_PROVIDER_ID,
  LIVE_FLIGHT_PROVIDER_PILOT_FEATURE_ID,
  LIVE_FLIGHT_PROVIDER_PILOT_VERSION,
  createFlightPilotTelemetry,
  isLiveFlightProviderPilotEnabled,
  mapLiveFlightErrorCode,
  resetFlightPilotTelemetry,
  runLiveFlightProviderPilot,
  shouldUseLiveFlightProviderPilot,
} from '../agent/conversationalProvider'
import { runConversationAwareFlightSearch } from '../agent/integrationFlightSearch'
import { createFlightSearchEngine, resetDefaultFlightSearchEngine } from '../agent/flightSearchEngine'
import { resetDefaultProviderRuntimeRegistry } from '../agent/providerRuntime'
import { emptyRequirements, mergeRequirements } from '../agent'
import type { AgentToolContext } from '../agent/tools/types'
import type { LiveFlightSearchResult } from '../agent/liveFlightSearch'
import { SPRINT105_LIVE_FLIGHT_SEARCH_VERSION } from '../agent/liveFlightSearch'

function ctx(partial?: {
  requirements?: Partial<ReturnType<typeof emptyRequirements>>
  input?: Record<string, unknown>
}): AgentToolContext {
  const requirements = mergeRequirements(emptyRequirements(), {
    origin: 'Riyadh',
    destination: 'Morocco',
    destinations: ['Morocco'],
    startDate: '2026-08-01',
    travelers: 2,
    budgetCurrency: 'SAR',
    durationDays: 5,
    ...partial?.requirements,
  })
  return {
    locale: 'ar',
    requirements,
    input: partial?.input ?? {},
  } as AgentToolContext
}

function liveSuccess(overrides?: Partial<LiveFlightSearchResult>): LiveFlightSearchResult {
  return {
    version: SPRINT105_LIVE_FLIGHT_SEARCH_VERSION,
    enabled: true,
    ok: true,
    empty: false,
    flights: [
      {
        id: 'amd_1',
        providerId: 'amadeus',
        airline: 'SV',
        carrierCode: 'SV',
        price: 1200,
        currency: 'SAR',
        durationMinutes: 360,
        stops: 0,
        cabin: 'economy',
        origin: 'RUH',
        destination: 'CMN',
        departureAt: '2026-08-01T08:00:00Z',
        arrivalAt: '2026-08-01T14:00:00Z',
        refundable: true,
        seatsRemaining: 4,
        providerConfidence: 0.95,
        availability: 'available',
        title: 'SV RUH→CMN',
      },
    ],
    flightOffers: [],
    latencyMs: 42,
    attempts: 1,
    error: null,
    validationErrors: [],
    logs: [],
    meta: {
      origin: 'RUH',
      destination: 'CMN',
      departureDate: '2026-08-01',
      adults: 2,
      children: 0,
      currency: 'SAR',
      providerId: 'amadeus',
      maxResults: 10,
      nonStop: null,
    },
    ...overrides,
  }
}

function liveFailure(
  code: string,
  extras?: Partial<NonNullable<LiveFlightSearchResult['error']>>,
): LiveFlightSearchResult {
  return liveSuccess({
    ok: false,
    empty: true,
    flights: [],
    error: {
      code,
      message: `provider ${code}`,
      retryable: code === 'TIMEOUT' || code === 'RATE_LIMITED',
      rateLimited: code === 'RATE_LIMITED',
      timedOut: code === 'TIMEOUT',
      httpStatus: code === 'UNAUTHORIZED' ? 401 : null,
      ...extras,
    },
  })
}

describe('Sprint 80 P1-4 — Live Flight Provider Pilot', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    resetDefaultProviderRuntimeRegistry()
    resetDefaultFlightSearchEngine()
    resetFlightPilotTelemetry()
  })

  afterEach(() => {
    resetFeatureRegistry()
    resetFlightPilotTelemetry()
  })

  describe('feature flag (default OFF)', () => {
    it('registers ai.live_flight_provider_pilot as OFF', () => {
      expect(LIVE_FLIGHT_PROVIDER_PILOT_FEATURE_ID).toBe('ai.live_flight_provider_pilot')
      expect(getFeatureRegistry().isEnabled(LIVE_FLIGHT_PROVIDER_PILOT_FEATURE_ID)).toBe(false)
      expect(isLiveFlightProviderPilotEnabled()).toBe(false)
      expect(shouldUseLiveFlightProviderPilot()).toBe(false)
      expect(LIVE_FLIGHT_PROVIDER_PILOT_VERSION).toMatch(/live-flight-provider-pilot/)
    })

    it('keeps production flight path unchanged when pilot is OFF', async () => {
      const engine = createFlightSearchEngine({ forceMock: true })
      const result = await runConversationAwareFlightSearch(engine, ctx())
      expect(result.empty).toBe(false)
      expect(Array.isArray(result.data.offers)).toBe(true)
      expect(result.data.conversationalProvider).toBeUndefined()
      expect(result.data.usedLive).toBeUndefined()
    })
  })

  describe('error mapping', () => {
    it('maps timeout / auth / parse codes', () => {
      expect(mapLiveFlightErrorCode({ code: 'TIMEOUT', timedOut: true })).toBe('TIMEOUT')
      expect(mapLiveFlightErrorCode({ code: 'UNAUTHORIZED', httpStatus: 401 })).toBe('AUTH_FAILURE')
      expect(mapLiveFlightErrorCode({ code: 'SECRETS_MISSING' })).toBe('AUTH_FAILURE')
      expect(mapLiveFlightErrorCode({ code: 'X', message: 'mapper parse failed' })).toBe(
        'PARSE_FAILURE',
      )
    })
  })

  describe('live success', () => {
    it('returns exact live tool schema via Amadeus provider (no provider bag)', async () => {
      const telemetry = createFlightPilotTelemetry()
      const engine = createFlightSearchEngine({ forceMock: true })
      const result = await runLiveFlightProviderPilot(engine, ctx(), {
        pilotEnabled: true,
        runLive: async () => liveSuccess(),
        telemetry,
      })

      expect(result.empty).toBe(false)
      expect(Array.isArray(result.data.offers)).toBe(true)
      expect((result.data.offers as unknown[]).length).toBeGreaterThan(0)
      expect(result.data.searchEngine).toBe('liveFlightSearch')
      expect(result.data.usedLive).toBe(true)
      expect(result.data.conversationalProvider).toBeUndefined()
      expect(result.gracefulMessage).toBeUndefined()

      const snap = telemetry.snapshot()
      expect(snap.searches).toBe(1)
      expect(snap.successes).toBe(1)
      expect(snap.fallbacks).toBe(0)
      expect(snap.lastEvent?.providerSelected).toBe(AMADEUS_LIVE_FLIGHT_PROVIDER_ID)
      expect(snap.lastEvent?.fallbackTriggered).toBe(false)
      expect(snap.lastEvent?.ok).toBe(true)
      expect(typeof snap.lastEvent?.latencyMs).toBe('number')
    })

    it('toolBridge pilotEnabled override routes through pilot', async () => {
      const engine = createFlightSearchEngine({ forceMock: true })
      const result = await runConversationAwareFlightSearch(engine, ctx(), {
        pilotEnabled: true,
        runLive: async () => liveSuccess(),
      })
      expect(result.data.usedLive).toBe(true)
      expect(result.data.searchEngine).toBe('liveFlightSearch')
    })
  })

  describe('timeout → automatic legacy fallback', () => {
    it('falls back silently without exposing provider errors', async () => {
      const telemetry = createFlightPilotTelemetry()
      const engine = createFlightSearchEngine({ forceMock: true })
      const result = await runLiveFlightProviderPilot(engine, ctx(), {
        pilotEnabled: true,
        runLive: async () => liveFailure('TIMEOUT', { timedOut: true }),
        telemetry,
      })

      expect(result.empty).toBe(false)
      expect(Array.isArray(result.data.offers)).toBe(true)
      expect(result.data.searchEngine).toBe('flightSearchEngine')
      expect(result.data.usedLive).toBeUndefined()
      expect(result.gracefulMessage).toBeUndefined()
      expect(JSON.stringify(result.data)).not.toMatch(/TIMEOUT|provider TIMEOUT/i)

      const snap = telemetry.snapshot()
      expect(snap.fallbacks).toBe(1)
      expect(snap.lastEvent?.fallbackTriggered).toBe(true)
      expect(snap.lastEvent?.errorCode).toBe('TIMEOUT')
      expect(snap.lastEvent?.mode).toBe('legacy')
    })
  })

  describe('auth failure → automatic legacy fallback', () => {
    it('falls back on UNAUTHORIZED without leaking auth details', async () => {
      const telemetry = createFlightPilotTelemetry()
      const engine = createFlightSearchEngine({ forceMock: true })
      const result = await runLiveFlightProviderPilot(engine, ctx(), {
        pilotEnabled: true,
        runLive: async () => liveFailure('UNAUTHORIZED', { httpStatus: 401 }),
        telemetry,
      })

      expect(result.empty).toBe(false)
      expect(result.data.searchEngine).toBe('flightSearchEngine')
      // Avoid matching UUID hex fragments (e.g. "...-401c-...") as leaked "401".
      expect(JSON.stringify(result.data)).not.toMatch(/UNAUTHORIZED|OAuth/i)
      expect(result.data.diagnostics?.gracefulMessage ?? '').not.toMatch(/UNAUTHORIZED|401|OAuth/i)
      expect(telemetry.snapshot().lastEvent?.errorCode).toBe('AUTH_FAILURE')
      expect(telemetry.snapshot().fallbacks).toBe(1)
    })
  })

  describe('parser failure → automatic legacy fallback', () => {
    it('falls back when live offers are malformed', async () => {
      const telemetry = createFlightPilotTelemetry()
      const engine = createFlightSearchEngine({ forceMock: true })
      const result = await runLiveFlightProviderPilot(engine, ctx(), {
        pilotEnabled: true,
        runLive: async () =>
          liveSuccess({
            flights: [
              {
                id: '',
                providerId: 'amadeus',
                airline: null,
                carrierCode: null,
                price: null,
                currency: 'SAR',
                durationMinutes: null,
                stops: null,
                cabin: null,
                origin: 'RUH',
                destination: 'CMN',
                departureAt: null,
                arrivalAt: null,
                refundable: false,
                seatsRemaining: null,
                providerConfidence: 0,
                availability: null,
                title: '',
              },
            ],
          }),
        telemetry,
      })

      expect(result.empty).toBe(false)
      expect(result.data.searchEngine).toBe('flightSearchEngine')
      expect(telemetry.snapshot().lastEvent?.errorCode).toBe('PARSE_FAILURE')
      expect(telemetry.snapshot().fallbacks).toBe(1)
      expect(JSON.stringify(result.data)).not.toMatch(/parse_failure/i)
    })
  })

  describe('provider unavailable → automatic legacy fallback', () => {
    it('falls back when live runner reports PROVIDER_UNAVAILABLE', async () => {
      const telemetry = createFlightPilotTelemetry()
      const engine = createFlightSearchEngine({ forceMock: true })
      const result = await runLiveFlightProviderPilot(engine, ctx(), {
        pilotEnabled: true,
        runLive: async () => liveFailure('PROVIDER_UNAVAILABLE'),
        telemetry,
      })
      expect(result.empty).toBe(false)
      expect(result.data.searchEngine).toBe('flightSearchEngine')
      expect(telemetry.snapshot().lastEvent?.errorCode).toBe('PROVIDER_UNAVAILABLE')
      expect(telemetry.snapshot().lastEvent?.providerSelected).toBe(
        AMADEUS_LIVE_FLIGHT_PROVIDER_ID,
      )
    })
  })

  describe('hotels untouched', () => {
    it('does not register a hotel pilot flag side-effect on flight flag default', () => {
      expect(getFeatureRegistry().isEnabled('ai.live_hotel_search')).toBe(false)
      expect(getFeatureRegistry().isEnabled('ai.conversational_provider_unify')).toBe(false)
      expect(getFeatureRegistry().isEnabled(LIVE_FLIGHT_PROVIDER_PILOT_FEATURE_ID)).toBe(false)
    })
  })
})
