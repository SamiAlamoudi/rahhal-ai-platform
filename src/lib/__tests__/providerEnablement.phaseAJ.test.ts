/**
 * Phase AJ — Live Provider Enablement Preparation deterministic tests.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import {
  checkAllProviderReadiness,
  checkProviderReadiness,
  createDefaultProviderAdapters,
  createLiveIntegration,
  flightOffersToNormalizedOffers,
  getProviderConfigurationRegistry,
  getProviderDiagnostics,
  getRegistryEntry,
  hotelOffersToNormalizedOffers,
  locationToNormalizedOffer,
  maskSecretValue,
  PROVIDER_FAILURE_POLICY,
  resolveEnablementAwareFeatureFlags,
  resolveProviderEnablementFlags,
  routeLegsToNormalizedOffers,
  runProvidersCheck,
  runSandboxProbes,
  selectProviderForCapability,
  validateSecretPresence,
  weatherSnapshotToNormalizedOffer,
} from '../agent/aggregation'
import { createTripPlannerService } from '../ai/tripPlanner'
import { getDefaultPaymentProviderType } from '../payment'
import { resetAppConfig } from '../ops'
import type { NormalizedFlightOffer } from '../../integrations/providers/amadeus/flightNormalization'
import type { HotelOffer } from '../../utils/contracts/models/hotel'
import type { CanonicalLocation, CanonicalRouteLeg } from '../../integrations/providers/googleMaps/types'
import type { CanonicalWeatherSnapshot } from '../../integrations/providers/openWeather/types'

describe('Phase AJ — Live Provider Enablement Preparation', () => {
  beforeEach(() => {
    resetAppConfig()
  })

  it('defaults keep every live provider OFF and payment mock', () => {
    const flags = resolveProviderEnablementFlags({})
    expect(flags.masterLive).toBe(false)
    expect(flags.capabilities.flights.live).toBe(false)
    expect(flags.capabilities.hotels.live).toBe(false)
    expect(flags.capabilities.maps.live).toBe(false)
    expect(flags.capabilities.weather.live).toBe(false)
    expect(flags.capabilities.transport.live).toBe(false)
    expect(flags.capabilities.activities.live).toBe(false)
    expect(getDefaultPaymentProviderType()).toBe('mock')

    const phaseW = resolveEnablementAwareFeatureFlags({})
    expect(phaseW.liveIntegrationEnabled).toBe(false)
    expect(phaseW.providers.amadeus).toBe(false)
    expect(phaseW.providers.booking_com).toBe(false)
  })

  it('missing credentials while flags are OFF does not crash and stays mock', () => {
    const readiness = checkAllProviderReadiness({
      env: { VITE_LIVE_PROVIDERS_ENABLED: 'false' },
    })
    expect(readiness.length).toBeGreaterThan(0)
    const amadeus = readiness.find((r) => r.provider === 'amadeus')
    expect(amadeus?.enabled).toBe(false)
    expect(amadeus?.configured).toBe(false)
    const decision = selectProviderForCapability('flights', {
      env: { VITE_LIVE_PROVIDERS_ENABLED: 'false' },
    })
    expect(decision.outcome).toBe('mock_default')
    expect(decision.selectedProviderId).toBe('amadeus_mock')
  })

  it('missing credentials while a flag is ON prevents live enablement and falls back', () => {
    const env = {
      VITE_LIVE_PROVIDERS_ENABLED: 'true',
      VITE_PROVIDERS_FLIGHTS_LIVE: 'true',
      VITE_FLIGHTS_PROVIDER: 'amadeus',
      VITE_PROVIDER_MOCK_FALLBACK: 'true',
    }
    const readiness = checkProviderReadiness(getRegistryEntry('amadeus')!, { env })
    expect(readiness.enabled).toBe(false)
    expect(readiness.reason).toMatch(/missing_required_secrets/)
    const decision = selectProviderForCapability('flights', { env })
    expect(decision.outcome).toBe('fallback_mock')
    expect(decision.fallbackUsed).toBe(true)
    expect(decision.selectedProviderId).toBe('amadeus_mock')
  })

  it('invalid provider selection is rejected', () => {
    const decision = selectProviderForCapability('flights', {
      flags: {
        masterLive: true,
        mockFallbackEnabled: true,
        strictLive: false,
        capabilities: {
          flights: { live: true, provider: 'not-a-real-provider' },
          hotels: { live: false, provider: 'mock' },
          maps: { live: false, provider: 'mock' },
          weather: { live: false, provider: 'mock' },
          transport: { live: false, provider: 'mock' },
          activities: { live: false, provider: 'mock' },
        },
      },
    })
    expect(decision.outcome).toBe('invalid_selection')
  })

  it('sandbox versus production configuration detection', () => {
    const sandbox = checkProviderReadiness(getRegistryEntry('amadeus')!, {
      env: {
        AMADEUS_CLIENT_ID: 'id',
        AMADEUS_CLIENT_SECRET: 'secret',
        AMADEUS_BASE_URL: 'https://test.api.amadeus.com',
        AMADEUS_ENV: 'sandbox',
      },
    })
    expect(sandbox.environment).toBe('sandbox')

    const production = checkProviderReadiness(getRegistryEntry('amadeus')!, {
      env: {
        AMADEUS_CLIENT_ID: 'id',
        AMADEUS_CLIENT_SECRET: 'secret',
        AMADEUS_BASE_URL: 'https://api.amadeus.com',
        AMADEUS_ENV: 'production',
        VITE_DEPLOY_TARGET: 'production',
      },
    })
    expect(production.environment).toBe('production')
  })

  it('mock default selection via factory adapters', () => {
    const adapters = createDefaultProviderAdapters()
    expect(adapters.length).toBeGreaterThan(0)
    const integration = createLiveIntegration()
    expect(integration.flags.liveIntegrationEnabled).toBe(false)
    expect(integration.flags.providers.amadeus).toBe(false)
  })

  it('successful live-provider selection with fake valid config', () => {
    const env = {
      VITE_LIVE_PROVIDERS_ENABLED: 'true',
      VITE_PROVIDERS_FLIGHTS_LIVE: 'true',
      VITE_FLIGHTS_PROVIDER: 'amadeus',
      AMADEUS_CLIENT_ID: 'client',
      AMADEUS_CLIENT_SECRET: 'secret',
      AMADEUS_BASE_URL: 'https://test.api.amadeus.com',
      AMADEUS_ENV: 'sandbox',
    }
    const readiness = checkProviderReadiness(getRegistryEntry('amadeus')!, { env })
    expect(readiness.configured).toBe(true)
    expect(readiness.enabled).toBe(true)
    expect(readiness.healthy).toBe(true)
    const decision = selectProviderForCapability('flights', { env })
    expect(decision.outcome).toBe('live_selected')
    expect(decision.selectedProviderId).toBe('amadeus')
    expect(decision.source).toBe('live')

    const flags = resolveEnablementAwareFeatureFlags(env)
    expect(flags.providers.amadeus).toBe(true)
  })

  it('strict-live failure without fallback', () => {
    const decision = selectProviderForCapability('flights', {
      env: {
        VITE_LIVE_PROVIDERS_ENABLED: 'true',
        VITE_PROVIDERS_FLIGHTS_LIVE: 'true',
        VITE_FLIGHTS_PROVIDER: 'amadeus',
        VITE_PROVIDER_STRICT_LIVE: 'true',
      },
    })
    expect(decision.outcome).toBe('strict_live_rejected')
    expect(decision.fallbackUsed).toBe(false)
  })

  it('circuit-open is reflected in readiness reason', () => {
    const env = {
      VITE_LIVE_PROVIDERS_ENABLED: 'true',
      VITE_PROVIDERS_FLIGHTS_LIVE: 'true',
      VITE_FLIGHTS_PROVIDER: 'amadeus',
      AMADEUS_CLIENT_ID: 'client',
      AMADEUS_CLIENT_SECRET: 'secret',
    }
    const readiness = checkProviderReadiness(getRegistryEntry('amadeus')!, {
      env,
      circuitState: { amadeus: 'open' },
    })
    expect(readiness.reason).toMatch(/circuit_open/)
    expect(readiness.healthy).toBe(false)
  })

  it('registry exposes retry and rate-limit policies from AppConfig defaults', () => {
    const amadeus = getRegistryEntry('amadeus')!
    expect(amadeus.retryPolicy.maxAttempts).toBeGreaterThan(0)
    expect(amadeus.rateLimitPolicy.maxRequests).toBeGreaterThan(0)
    expect(amadeus.circuitBreakerPolicy.failureThreshold).toBeGreaterThan(0)
    expect(amadeus.requiredSecretNames).toContain('AMADEUS_CLIENT_ID')
    expect(getProviderConfigurationRegistry().some((e) => e.capability === 'transport')).toBe(true)
    expect(getProviderConfigurationRegistry().some((e) => e.capability === 'activities')).toBe(true)
    expect(PROVIDER_FAILURE_POLICY.some((r) => r.scenario === 'strict_live_mode')).toBe(true)
  })

  it('admin diagnostics authorized; non-admin denied; secrets masked', () => {
    const denied = getProviderDiagnostics({ user: { id: 'u1', role: 'user' } })
    expect(denied.ok).toBe(false)
    if (!denied.ok) expect(denied.status).toBe(403)

    const unauth = getProviderDiagnostics({ user: null })
    expect(unauth.ok).toBe(false)
    if (!unauth.ok) expect(unauth.status).toBe(401)

    const admin = getProviderDiagnostics({
      user: { id: 'admin1', role: 'admin' },
      env: {
        AMADEUS_CLIENT_ID: 'super-secret-client',
        AMADEUS_CLIENT_SECRET: 'super-secret-value',
      },
    })
    expect(admin.ok).toBe(true)
    if (admin.ok) {
      const text = JSON.stringify(admin.report)
      expect(text).not.toContain('super-secret')
      expect(admin.report.paymentProvider).toBe('mock')
      const amadeus = admin.report.readiness.find((r) => r.provider === 'amadeus')
      expect(amadeus?.secretsPresent.every((s) => s.masked === '[set]' || s.masked === '[missing]')).toBe(true)
    }

    expect(maskSecretValue('abcdefghij')).toContain('[redacted')
    expect(validateSecretPresence(['AMADEUS_CLIENT_ID'], {}).every((s) => !s.present)).toBe(true)
  })

  it('default CLI performs no network calls; probe requires explicit opt-in', async () => {
    const check = await runProvidersCheck({
      env: { VITE_PAYMENT_PROVIDER: 'mock' },
      argv: ['node', 'providers:check'],
    })
    expect(check.probed).toBe(false)
    expect(check.report).toContain('No network calls performed')

    const probe = await runSandboxProbes(['amadeus'], {
      probeEnabled: false,
    })
    expect(probe.attempted).toBe(false)

    const refused = await runSandboxProbes(['amadeus'], {
      probeEnabled: true,
      confirmProduction: false,
      env: {
        AMADEUS_CLIENT_ID: 'x',
        AMADEUS_CLIENT_SECRET: 'y',
        AMADEUS_BASE_URL: 'https://api.amadeus.com',
        AMADEUS_ENV: 'production',
        VITE_LIVE_PROVIDERS_ENABLED: 'true',
        VITE_PROVIDERS_FLIGHTS_LIVE: 'true',
        VITE_FLIGHTS_PROVIDER: 'amadeus',
      },
    })
    expect(refused.refusedReason).toMatch(/production_probe/)
  })

  it('canonical normalization for flights/hotels/maps/weather', () => {
    const flightOffers: NormalizedFlightOffer[] = [{
      id: 'OFF1',
      providerId: 'amadeus',
      title: 'SV RUH→JED',
      currency: 'SAR',
      price: 1200,
      originalPrice: null,
      rating: 4,
      itinerary: {
        segments: [{
          origin: 'RUH',
          destination: 'JED',
          departure: '2027-05-01T08:00:00+03:00',
          arrival: '2027-05-01T10:00:00+03:00',
          carrier: 'SV',
          flightNumber: 'SV123',
          aircraft: null,
          cabin: 'economy',
          durationMinutes: 120,
        }],
        totalDuration: 120,
        stops: 0,
        refundable: false,
        baggageIncluded: true,
      },
      familyFriendly: true,
      cancellationPolicy: 'non-refundable',
      bookingClass: 'Y',
      travelTimeScore: 80,
      overallFlightQuality: 85,
    }]
    const flights = flightOffersToNormalizedOffers(flightOffers, 'amadeus')
    expect(flights[0]?.domain).toBe('flights')
    expect(flights[0]?.currency).toBe('SAR')
    expect(flights[0]?.payload).toMatchObject({
      from: 'RUH',
      to: 'JED',
      source: 'amadeus',
    })

    const hotelOffers: HotelOffer[] = [{
      id: 'H1',
      providerId: 'booking_com',
      title: 'Hotel',
      currency: 'USD',
      price: 400,
      originalPrice: null,
      rating: 8.5,
      hotelStars: 4,
      location: 'Riyadh',
      area: 'Olaya',
      checkIn: '2027-05-01',
      checkOut: '2027-05-05',
      familyFriendly: true,
      breakfastIncluded: true,
      freeCancellation: true,
      amenities: ['wifi'],
      roomTypes: [{ name: 'Deluxe', capacity: 2, bedType: 'king', count: 1 }],
    }]
    const hotels = hotelOffersToNormalizedOffers(hotelOffers, 'booking_com', 4)
    expect(hotels[0]?.domain).toBe('hotels')
    expect(hotels[0]?.payload).toMatchObject({
      freeCancellation: true,
      nights: 4,
      source: 'booking',
    })

    const legs: CanonicalRouteLeg[] = [{
      from: 'A',
      to: 'B',
      mode: 'driving',
      distanceKm: 1,
      durationMinutes: 10,
      fromLocation: null,
      toLocation: null,
    }]
    const routes = routeLegsToNormalizedOffers(legs, 'google_maps')
    expect(routes[0]?.domain).toBe('maps')
    expect(routes[0]?.payload).toMatchObject({ distanceKm: 1, durationMinutes: 10 })

    const place: CanonicalLocation = {
      label: 'Riyadh',
      name: 'Place',
      formattedAddress: 'Riyadh',
      placeId: 'P1',
      lat: 24.7,
      lng: 46.7,
      countryCode: 'SA',
      country: 'Saudi Arabia',
      city: 'Riyadh',
      types: ['locality'],
      timezoneId: 'Asia/Riyadh',
    }
    const placeOffer = locationToNormalizedOffer(place, 'google_maps', 'geocode')
    expect(placeOffer.fingerprint).toBeTruthy()
    expect(placeOffer.payload).toMatchObject({ kind: 'geocode', source: 'google_maps' })

    const snapshot: CanonicalWeatherSnapshot = {
      destination: 'Riyadh',
      summary: 'Clear in Riyadh',
      averageHighC: 35,
      averageLowC: 22,
      season: 'summer',
      current: {
        destination: 'Riyadh',
        observedAt: '2027-05-01T12:00:00.000Z',
        tempC: 35,
        feelsLikeC: 36,
        humidity: 20,
        windKph: 10,
        visibilityKm: 10,
        uvIndex: 8,
        condition: 'clear',
        description: 'clear sky',
        sunrise: null,
        sunset: null,
        rainProbability: 0.14,
      },
      hourly: [],
      daily: [{
        date: '2027-05-01',
        tempHighC: 36,
        tempLowC: 22,
        feelsLikeC: 34,
        humidity: 20,
        windKph: 10,
        visibilityKm: null,
        uvIndex: null,
        rainProbability: 0.14,
        condition: 'clear',
        description: 'clear sky',
        sunrise: null,
        sunset: null,
      }],
      alerts: [{
        event: 'Heat advisory',
        severity: 'moderate',
        description: 'High temperatures',
        start: '2027-05-01T00:00:00.000Z',
        end: '2027-05-02T00:00:00.000Z',
        sender: 'NWS',
      }],
      packingHints: ['Light clothing'],
      travelTips: ['Hydrate'],
    }
    const weather = weatherSnapshotToNormalizedOffer(snapshot, 'openweather')
    expect(weather.domain).toBe('weather')
    expect(weather.payload).toMatchObject({
      averageHighC: 35,
      source: 'openweather',
    })
    expect((weather.payload as { alerts: unknown[] }).alerts).toHaveLength(1)
  })

  it('transport/activities remain mock-only with unsupported live handling', () => {
    const transport = selectProviderForCapability('transport', {
      flags: {
        masterLive: true,
        mockFallbackEnabled: true,
        strictLive: false,
        capabilities: {
          flights: { live: false, provider: 'mock' },
          hotels: { live: false, provider: 'mock' },
          maps: { live: false, provider: 'mock' },
          weather: { live: false, provider: 'mock' },
          transport: { live: true, provider: 'rome2rio' },
          activities: { live: true, provider: 'viator' },
        },
      },
    })
    expect(transport.source).toBe('mock')
    expect(['invalid_selection', 'fallback_mock']).toContain(transport.outcome)
    expect(getRegistryEntry('transport_mock')?.liveAdapterAvailable).toBe(false)
    expect(getRegistryEntry('activities_mock')?.liveAdapterAvailable).toBe(false)
  })

  it('preserves TripPlannerService + ProviderAdapter contracts with defaults', async () => {
    const service = createTripPlannerService({
      clockStartMs: Date.UTC(2026, 6, 15, 18, 0, 0),
    })
    const result = await service.plan({
      requestId: 'req_aj_compat',
      userId: 'user_aj',
      destinations: ['Istanbul'],
      origin: 'Riyadh',
      startDate: '2027-06-01',
      endDate: '2027-06-05',
      travelers: { adults: 2 },
      currency: 'SAR',
      includeBookingPreview: false,
      idempotencyKey: 'idem_aj_compat',
    })
    expect(result.status).toBe('completed')
    expect(getDefaultPaymentProviderType()).toBe('mock')
  })

  it('forbids client-side secret exposure in readiness', () => {
    const secrets = validateSecretPresence(['AMADEUS_CLIENT_ID'], {
      VITE_AMADEUS_CLIENT_ID: 'leaked',
    })
    expect(secrets.some((s) => s.forbiddenClientExposure)).toBe(true)
  })
})
