/**
 * Phase AK — Single Live Provider Sandbox Enablement deterministic tests.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import {
  createAmadeusSandboxProbeFn,
  createLiveIntegration,
  enforceSingleLiveCapability,
  getProviderDiagnostics,
  PRIMARY_SANDBOX_CAPABILITY,
  PRIMARY_SANDBOX_PROVIDER_ID,
  resolveEnablementAwareFeatureFlags,
  resolveProviderEnablementFlags,
  runProvidersCheck,
  runSandboxProbes,
  selectProviderForCapability,
} from '../agent/aggregation'
import { getDefaultPaymentProviderType } from '../payment'
import { resetAppConfig } from '../ops'

describe('Phase AK — Single Live Provider Sandbox Enablement', () => {
  beforeEach(() => {
    resetAppConfig()
  })

  it('keeps every live provider OFF by default and payment mock', () => {
    const flags = resolveProviderEnablementFlags({})
    expect(flags.masterLive).toBe(false)
    expect(flags.allowedLiveCapability).toBeNull()
    expect(flags.exclusivitySuppressed).toEqual([])
    expect(getDefaultPaymentProviderType()).toBe('mock')
    expect(PRIMARY_SANDBOX_PROVIDER_ID).toBe('amadeus')
    expect(PRIMARY_SANDBOX_CAPABILITY).toBe('flights')
  })

  it('clamps multiple live capabilities to a single winner (flights preferred)', () => {
    const flags = resolveProviderEnablementFlags({
      VITE_LIVE_PROVIDERS_ENABLED: 'true',
      VITE_PROVIDERS_FLIGHTS_LIVE: 'true',
      VITE_PROVIDERS_HOTELS_LIVE: 'true',
      VITE_PROVIDERS_MAPS_LIVE: 'true',
      VITE_FLIGHTS_PROVIDER: 'amadeus',
      VITE_HOTELS_PROVIDER: 'booking',
      VITE_MAPS_PROVIDER: 'google_maps',
    })
    expect(flags.capabilities.flights.live).toBe(true)
    expect(flags.capabilities.hotels.live).toBe(false)
    expect(flags.capabilities.maps.live).toBe(false)
    expect(flags.allowedLiveCapability).toBe('flights')
    expect(flags.exclusivitySuppressed).toEqual(['hotels', 'maps'])

    const hotels = selectProviderForCapability('hotels', { flags })
    expect(hotels.outcome).toBe('mock_default')
    expect(hotels.source).toBe('mock')
  })

  it('honors VITE_SINGLE_LIVE_CAPABILITY when resolving conflicts', () => {
    const flags = resolveProviderEnablementFlags({
      VITE_LIVE_PROVIDERS_ENABLED: 'true',
      VITE_PROVIDERS_FLIGHTS_LIVE: 'true',
      VITE_PROVIDERS_HOTELS_LIVE: 'true',
      VITE_SINGLE_LIVE_CAPABILITY: 'hotels',
      VITE_HOTELS_PROVIDER: 'booking',
    })
    expect(flags.allowedLiveCapability).toBe('hotels')
    expect(flags.capabilities.hotels.live).toBe(true)
    expect(flags.capabilities.flights.live).toBe(false)
    expect(flags.exclusivitySuppressed).toContain('flights')
  })

  it('selects Amadeus alone with fake valid sandbox config', () => {
    const env = {
      VITE_LIVE_PROVIDERS_ENABLED: 'true',
      VITE_PROVIDERS_FLIGHTS_LIVE: 'true',
      VITE_FLIGHTS_PROVIDER: 'amadeus',
      AMADEUS_CLIENT_ID: 'client',
      AMADEUS_CLIENT_SECRET: 'secret',
      AMADEUS_BASE_URL: 'https://test.api.amadeus.com',
      AMADEUS_ENV: 'sandbox',
      VITE_PAYMENT_PROVIDER: 'mock',
    }
    const decision = selectProviderForCapability('flights', { env })
    expect(decision.outcome).toBe('live_selected')
    expect(decision.selectedProviderId).toBe('amadeus')
    expect(decision.source).toBe('live')

    const phaseW = resolveEnablementAwareFeatureFlags(env)
    expect(phaseW.providers.amadeus).toBe(true)
    expect(phaseW.providers.booking_com).toBe(false)
    expect(phaseW.providers.google_maps).toBe(false)
    expect(phaseW.providers.openweather).toBe(false)
  })

  it('does not enable a second live provider via factory while Amadeus is live', () => {
    const env = {
      VITE_LIVE_PROVIDERS_ENABLED: 'true',
      VITE_PROVIDERS_FLIGHTS_LIVE: 'true',
      VITE_PROVIDERS_HOTELS_LIVE: 'true',
      VITE_FLIGHTS_PROVIDER: 'amadeus',
      VITE_HOTELS_PROVIDER: 'booking',
      AMADEUS_CLIENT_ID: 'client',
      AMADEUS_CLIENT_SECRET: 'secret',
      AMADEUS_BASE_URL: 'https://test.api.amadeus.com',
      BOOKING_RAPIDAPI_KEY: 'rapid-key',
    }
    const integration = createLiveIntegration({
      flags: resolveEnablementAwareFeatureFlags(env),
    })
    expect(integration.flags.providers.amadeus).toBe(true)
    expect(integration.flags.providers.booking_com).toBe(false)
  })

  it('admin diagnostics expose exclusivity fields without secrets', () => {
    const admin = getProviderDiagnostics({
      user: { id: 'admin1', role: 'admin' },
      env: {
        VITE_LIVE_PROVIDERS_ENABLED: 'true',
        VITE_PROVIDERS_FLIGHTS_LIVE: 'true',
        VITE_PROVIDERS_WEATHER_LIVE: 'true',
        AMADEUS_CLIENT_ID: 'super-secret',
      },
    })
    expect(admin.ok).toBe(true)
    if (admin.ok) {
      expect(admin.report.paymentProvider).toBe('mock')
      expect(admin.report.primarySandboxProvider).toBe('amadeus')
      expect(admin.report.allowedLiveCapability).toBe('flights')
      expect(admin.report.exclusivitySuppressed).toContain('weather')
      expect(JSON.stringify(admin.report)).not.toContain('super-secret')
    }
  })

  it('default CLI is Phase AK, no network; probe is Amadeus-only and opt-in', async () => {
    const check = await runProvidersCheck({
      env: { VITE_PAYMENT_PROVIDER: 'mock' },
      argv: ['node', 'providers:check'],
    })
    expect(check.probed).toBe(false)
    expect(check.report).toContain('Phase AK')
    expect(check.report).toContain('primarySandboxProvider=amadeus')
    expect(check.report).toContain('No network calls performed')

    const probe = await runSandboxProbes(['amadeus', 'booking_com', 'google_maps'], {
      probeEnabled: true,
      amadeusOnly: true,
      probeFn: async (id) => ({ ok: id === 'amadeus', reason: 'injected' }),
      env: {
        AMADEUS_CLIENT_ID: 'x',
        AMADEUS_CLIENT_SECRET: 'y',
        AMADEUS_BASE_URL: 'https://test.api.amadeus.com',
      },
    })
    expect(probe.attempted).toBe(true)
    expect(probe.results.every((r) => r.provider === 'amadeus')).toBe(true)
  })

  it('Amadeus sandbox probeFn refuses production hosts and missing secrets', async () => {
    const missing = await createAmadeusSandboxProbeFn({
      env: { AMADEUS_BASE_URL: 'https://test.api.amadeus.com' },
    })('amadeus')
    expect(missing.ok).toBe(false)
    expect(missing.reason).toMatch(/missing_required_secrets/)

    const production = await createAmadeusSandboxProbeFn({
      env: {
        AMADEUS_CLIENT_ID: 'id',
        AMADEUS_CLIENT_SECRET: 'secret',
        AMADEUS_BASE_URL: 'https://api.amadeus.com',
      },
    })('amadeus')
    expect(production.ok).toBe(false)
    expect(production.reason).toMatch(/production/)

    const oauthOk = await createAmadeusSandboxProbeFn({
      env: {
        AMADEUS_CLIENT_ID: 'id',
        AMADEUS_CLIENT_SECRET: 'secret',
        AMADEUS_BASE_URL: 'https://test.api.amadeus.com',
      },
      fetchImpl: async () => new Response(JSON.stringify({ access_token: 't', expires_in: 60 }), { status: 200 }),
    })('amadeus')
    expect(oauthOk.ok).toBe(true)
    expect(oauthOk.reason).toMatch(/oauth_probe_ok/)
  })

  it('enforceSingleLiveCapability is idempotent when already single', () => {
    const flags = resolveProviderEnablementFlags({
      VITE_LIVE_PROVIDERS_ENABLED: 'true',
      VITE_PROVIDERS_FLIGHTS_LIVE: 'true',
    })
    const again = enforceSingleLiveCapability(flags)
    expect(again.conflict).toBe(false)
    expect(again.allowedLiveCapability).toBe('flights')
  })
})
