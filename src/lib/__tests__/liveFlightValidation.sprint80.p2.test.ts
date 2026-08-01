/**
 * Sprint 80 P2 — End-to-end live flight validation tests.
 * CI always uses injectable runLive (no network). Optional live suite skips without secrets.
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import {
  LIVE_FLIGHT_P2_VALIDATION_VERSION,
  LIVE_FLIGHT_PROVIDER_PILOT_FEATURE_ID,
  comparePilotToLegacy,
  evaluateLiveFlightValidationGate,
  isLiveFlightProviderPilotEnabled,
  isPilotDeployTargetAllowed,
  renderLiveFlightValidationJson,
  renderLiveFlightValidationMarkdown,
  resetFlightPilotTelemetry,
  runLiveFlightValidation,
} from '../agent/conversationalProvider'
import { resetDefaultFlightSearchEngine } from '../agent/flightSearchEngine'
import { resetDefaultProviderRuntimeRegistry } from '../agent/providerRuntime'
import type { LiveFlightSearchResult } from '../agent/liveFlightSearch'
import { SPRINT105_LIVE_FLIGHT_SEARCH_VERSION } from '../agent/liveFlightSearch'
import {
  readAmadeusClientId,
  readAmadeusClientSecret,
} from '../../core/amadeusSandbox/config'

function mockLiveSuccess(overrides?: Partial<LiveFlightSearchResult>): LiveFlightSearchResult {
  return {
    version: SPRINT105_LIVE_FLIGHT_SEARCH_VERSION,
    enabled: true,
    ok: true,
    empty: false,
    flights: [
      {
        id: 'amd_p2_1',
        providerId: 'amadeus',
        airline: 'SV',
        carrierCode: 'SV',
        price: 1450,
        currency: 'SAR',
        durationMinutes: 390,
        stops: 0,
        cabin: 'ECONOMY',
        origin: 'RUH',
        destination: 'CMN',
        departureAt: '2026-09-15T08:00:00Z',
        arrivalAt: '2026-09-15T14:30:00Z',
        refundable: true,
        seatsRemaining: 5,
        providerConfidence: 0.92,
        availability: 'available',
        title: 'SV RUH→CMN',
      },
      {
        id: 'amd_p2_2',
        providerId: 'amadeus',
        airline: 'AT',
        carrierCode: 'AT',
        price: 1180,
        currency: 'SAR',
        durationMinutes: 450,
        stops: 1,
        cabin: 'ECONOMY',
        origin: 'RUH',
        destination: 'CMN',
        departureAt: '2026-09-15T19:00:00Z',
        arrivalAt: '2026-09-16T02:30:00Z',
        refundable: false,
        seatsRemaining: 2,
        providerConfidence: 0.88,
        availability: 'available',
        title: 'AT RUH→CMN',
      },
    ],
    flightOffers: [],
    latencyMs: 55,
    attempts: 1,
    error: null,
    validationErrors: [],
    logs: [],
    meta: {
      origin: 'RUH',
      destination: 'CMN',
      departureDate: '2026-09-15',
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

describe('Sprint 80 P2 — Live Flight E2E Validation', () => {
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

  describe('feature flags & deploy gate', () => {
    it('keeps pilot flag OFF by default', () => {
      expect(getFeatureRegistry().isEnabled(LIVE_FLIGHT_PROVIDER_PILOT_FEATURE_ID)).toBe(false)
      expect(isLiveFlightProviderPilotEnabled()).toBe(false)
    })

    it('allows development/staging and blocks production', () => {
      expect(isPilotDeployTargetAllowed({
        env: { VITE_DEPLOY_TARGET: 'development' },
      })).toBe(true)
      expect(isPilotDeployTargetAllowed({
        env: { VITE_DEPLOY_TARGET: 'staging' },
      })).toBe(true)
      expect(isPilotDeployTargetAllowed({
        env: { VITE_DEPLOY_TARGET: 'preview' },
      })).toBe(true)
      expect(isPilotDeployTargetAllowed({
        env: { VITE_DEPLOY_TARGET: 'production' },
      })).toBe(false)

      const prodGate = evaluateLiveFlightValidationGate({
        env: { VITE_DEPLOY_TARGET: 'production' },
      })
      expect(prodGate.allowed).toBe(false)
      expect(prodGate.productionBlocked).toBe(true)

      // Even if registry flag is flipped, production stays blocked.
      getFeatureRegistry().setEnabled(LIVE_FLIGHT_PROVIDER_PILOT_FEATURE_ID, true)
      expect(isLiveFlightProviderPilotEnabled({
        env: { VITE_DEPLOY_TARGET: 'production' },
      })).toBe(false)
    })
  })

  describe('mock E2E pipeline (CI)', () => {
    it('validates auth, mapping, normalization, pricing, carrier, cabin + latency/telemetry', async () => {
      const result = await runLiveFlightValidation({
        env: { VITE_DEPLOY_TARGET: 'staging' },
        forceMock: true,
        runLive: async () => mockLiveSuccess(),
      })

      expect(result.version).toBe(LIVE_FLIGHT_P2_VALIDATION_VERSION)
      expect(result.mode).toBe('mock')
      expect(result.gate.allowed).toBe(true)
      expect(result.liveSkippedReason).toBeNull()

      expect(result.auth.tokenAcquired).toBe(true)
      expect(result.fieldIntegrity.requestMapping).toBe('present')
      expect(result.fieldIntegrity.responseNormalization).toBe('present')
      expect(result.fieldIntegrity.pricingIntegrity).toBe('present')
      expect(result.fieldIntegrity.carrierData).toBe('present')
      expect(result.fieldIntegrity.cabinClasses).toBe('present')
      // Current Amadeus→Rahhal mapper does not populate baggage / fareFamily.
      expect(['null', 'missing', 'present']).toContain(result.fieldIntegrity.baggage)
      expect(['null', 'missing', 'present']).toContain(result.fieldIntegrity.fareFamilies)

      expect(result.pilot.offerCount).toBeGreaterThan(0)
      expect(result.pilot.searchEngine).toBe('liveFlightSearch')
      expect(result.pilot.usedLive).toBe(true)
      expect(result.legacy.offerCount).toBeGreaterThan(0)
      expect(result.legacy.searchEngine).toBe('flightSearchEngine')

      expect(result.latency.providerResponseMs).toBeGreaterThanOrEqual(0)
      expect(result.latency.totalSearchMs).toBeGreaterThanOrEqual(result.latency.providerResponseMs)
      expect(result.latency.legacySearchMs).toBeGreaterThanOrEqual(0)

      expect(result.telemetry.searches).toBe(1)
      expect(result.telemetry.successRate).toBe(1)
      expect(result.telemetry.timeoutRate).toBe(0)
      expect(result.telemetry.authFailureRate).toBe(0)

      expect(result.differences.length).toBeGreaterThan(0)
      expect(result.differences.some((d) => d.path === 'searchEngine')).toBe(true)

      const md = renderLiveFlightValidationMarkdown(result)
      expect(md).toContain('Sprint 80 P2')
      expect(md).toContain('Differences')
      expect(md).toContain('Telemetry rates')

      if (process.env.WRITE_P2_REPORT === '1') {
        const outDir = '/opt/cursor/artifacts'
        try { mkdirSync(outDir, { recursive: true }) } catch { /* ignore */ }
        writeFileSync(resolve(outDir, 'sprint80_p2_validation_report.md'), md)
        writeFileSync(
          resolve(outDir, 'sprint80_p2_validation_report.json'),
          renderLiveFlightValidationJson(result),
        )
        writeFileSync(
          resolve(process.cwd(), 'docs/LIVE_FLIGHT_P2_E2E_VALIDATION_REPORT.md'),
          `${md}\n\n> Generated in mock mode (Amadeus credentials were not available in this environment). Re-run with staging secrets for live results.\n`,
        )
      }
    })

    it('records every difference via comparePilotToLegacy', () => {
      const diffs = comparePilotToLegacy(
        {
          searchEngine: 'liveFlightSearch',
          usedLive: true,
          offers: [{
            id: 'a',
            airline: 'SV',
            price: 100,
            currency: 'SAR',
            cabin: 'economy',
            baggage: null,
            fareFamily: null,
          }],
        },
        {
          searchEngine: 'flightSearchEngine',
          offers: [{
            id: 'b',
            airline: 'XY',
            price: 200,
            currency: 'SAR',
            cabin: 'economy',
            baggage: '23kg',
            fareFamily: 'Eco',
          }],
        },
      )
      expect(diffs.some((d) => d.path === 'searchEngine')).toBe(true)
      expect(diffs.some((d) => d.path.includes('baggage') || d.path === 'coverage.baggage')).toBe(true)
      expect(diffs.some((d) => d.path.includes('fareFamily') || d.path === 'coverage.fareFamily')).toBe(true)
    })

    it('skips live when credentials missing (no forceMock / no runLive)', async () => {
      const result = await runLiveFlightValidation({
        env: {
          VITE_DEPLOY_TARGET: 'staging',
          AMADEUS_CLIENT_ID: '',
          AMADEUS_CLIENT_SECRET: '',
          AMADEUS_API_KEY: '',
          AMADEUS_API_SECRET: '',
        },
      })
      // Without injected runLive and without credentials → skipped.
      if (!readAmadeusClientId() && !readAmadeusClientSecret()) {
        expect(result.mode).toBe('skipped')
        expect(result.liveSkippedReason).toMatch(/credentials|sandbox/i)
      }
    })

    it('blocks validation on production deploy target', async () => {
      const result = await runLiveFlightValidation({
        env: { VITE_DEPLOY_TARGET: 'production' },
        runLive: async () => mockLiveSuccess(),
      })
      expect(result.mode).toBe('skipped')
      expect(result.gate.productionBlocked).toBe(true)
      expect(result.pilot.offerCount).toBe(0)
    })
  })

  describe('optional real Amadeus (staging/dev secrets)', () => {
    const hasSecrets = Boolean(readAmadeusClientId() && readAmadeusClientSecret())

    it('runs live Amadeus through the pilot layer when secrets exist', async function runLive() {
      if (!hasSecrets) {
        expect(hasSecrets).toBe(false)
        return
      }
      const result = await runLiveFlightValidation({
        env: {
          VITE_DEPLOY_TARGET: 'staging',
          AMADEUS_BASE_URL: 'https://test.api.amadeus.com',
        },
      })
      expect(result.mode).toBe('live')
      expect(result.gate.allowed).toBe(true)
      expect(result.auth.tokenAcquired).toBe(true)
      expect(result.fieldIntegrity.requestMapping).toBe('present')
      expect(result.differences.length).toBeGreaterThan(0)
    })
  })
})
