import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  createMultiProviderRegistry,
  executeProviderChain,
  getProviderHealthMonitor,
  resetProviderHealthMonitor,
  resetMultiProviderRegistry,
  clearMultiProviderConfigCache,
  DEFAULT_FLIGHT_CHAIN,
  classifyProviderError,
  shouldFailover,
  createPreparedAdapter,
  createMockDomainAdapter,
  type MultiProviderAdapter,
} from '../index'
import { createFlightService, resetFlightService } from '../../providers/flightService'
import { resetProviderRegistry } from '../../registry'
import { clearConfigCache } from '../../config/environment'
import type { ProviderRequest } from '../../../utils/contracts/providers/base'

const SAMPLE_REQ: ProviderRequest = {
  search: {
    destination: 'Casablanca',
    departureCity: 'Riyadh',
    departureDate: '2026-07-30',
    returnDate: '2026-08-06',
    durationDays: 7,
    travelPurpose: 'vacation',
    travelers: { adults: 1, children: 0, infants: 0, total: 1, type: 'solo' },
    budgetAmount: 5000,
    budgetCurrency: 'SAR',
    budgetPriority: 'balanced',
    preferredCabin: 'economy',
    directFlightPreferred: 'any',
    preferredDepartureTime: '',
    preferredArrivalTime: '',
    preferredAirlines: [],
    avoidAirlines: [],
    hotelStars: 4,
    hotelBudget: 800,
    preferredArea: '',
    familyFriendly: false,
    breakfastRequired: false,
    freeCancellation: false,
    hotelAmenities: [],
    activityStyle: '',
    shoppingInterest: 0,
    natureInterest: 0,
    cultureInterest: 0,
    beachInterest: 0,
    adventureInterest: 0,
    entertainmentInterest: 0,
    lowestPriceWeight: 0,
    comfortWeight: 0,
    timeWeight: 0,
    luxuryWeight: 0,
    familyWeight: 0,
    missingFields: [],
    highConfidence: [],
    mediumConfidence: [],
    lowConfidence: [],
    readyForSearch: true,
    completionPercentage: 100,
  },
}

describe('Multi Provider Registry', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    vi.stubEnv('VITE_MULTI_PROVIDER_ENABLED', 'true')
    vi.stubEnv('VITE_FLIGHT_PROVIDER_CHAIN', '')
    clearMultiProviderConfigCache()
    resetMultiProviderRegistry()
    resetProviderHealthMonitor()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    clearMultiProviderConfigCache()
    resetMultiProviderRegistry()
  })

  it('exposes default flight chain Duffel → Travelport → Sabre → Amadeus Enterprise → Mock', () => {
    expect(DEFAULT_FLIGHT_CHAIN).toEqual([
      'duffel',
      'travelport',
      'sabre',
      'amadeus_enterprise',
      'mock',
    ])
    const registry = createMultiProviderRegistry()
    const order = registry.getConfiguredOrder('flight')
    expect(order).toEqual(DEFAULT_FLIGHT_CHAIN)
    const chain = registry.getChain('flight')
    expect(chain.map((a) => a.id)).toEqual(DEFAULT_FLIGHT_CHAIN)
  })

  it('supports hotel, cars, activities, transfers domains', () => {
    const registry = createMultiProviderRegistry()
    expect(registry.getConfiguredOrder('hotel')[0]).toBe('booking')
    expect(registry.getConfiguredOrder('cars')[0]).toBe('rentalcars')
    expect(registry.getConfiguredOrder('activities')).toContain('viator')
    expect(registry.getConfiguredOrder('transfers')).toContain('mock')
  })

  it('allows configurable ordering via env', () => {
    vi.stubEnv('VITE_FLIGHT_PROVIDER_CHAIN', 'sabre,duffel,mock')
    clearMultiProviderConfigCache()
    const registry = createMultiProviderRegistry()
    expect(registry.getConfiguredOrder('flight')).toEqual(['sabre', 'duffel', 'mock'])
  })
})

describe('Failover classification', () => {
  it('classifies timeout, auth, quota, unavailable', () => {
    expect(classifyProviderError({ code: 'TIMEOUT', category: 'timeout', message: 't' })).toBe('timeout')
    expect(classifyProviderError({ code: 'AUTH', category: 'auth', message: 'x' })).toBe('authentication')
    expect(classifyProviderError({ code: 'RATE_LIMIT', category: 'rate-limit', message: '429' })).toBe('quota')
    expect(classifyProviderError({ code: 'NETWORK', category: 'network', message: 'down' })).toBe('unavailable')
    expect(shouldFailover('timeout')).toBe(true)
    expect(shouldFailover('authentication')).toBe(true)
    expect(shouldFailover('quota')).toBe(true)
    expect(shouldFailover('unavailable')).toBe(true)
  })
})

describe('Automatic fallback chain', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    vi.stubEnv('VITE_MULTI_PROVIDER_ENABLED', 'true')
    vi.stubEnv('VITE_FLIGHT_PROVIDER_CHAIN', '')
    clearMultiProviderConfigCache()
    resetMultiProviderRegistry()
    resetProviderHealthMonitor()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    clearMultiProviderConfigCache()
  })

  it('skips prepared providers and lands on mock', async () => {
    const result = await executeProviderChain({
      domain: 'flight',
      req: SAMPLE_REQ,
    })
    expect(result.success).toBe(true)
    expect(result.providerId).toBe('mock')
    expect(result.source).toBe('mock')
    expect(result.data).toBeTruthy()
    expect(result.attempts.some((a) => a.providerId === 'duffel' && a.reason === 'not_configured')).toBe(true)
    expect(result.attempts.some((a) => a.providerId === 'travelport')).toBe(true)
    expect(result.attempts.some((a) => a.providerId === 'sabre')).toBe(true)
  })

  it('fails over on timeout → authentication → quota → unavailable', async () => {
    const failing = (id: 'duffel' | 'travelport' | 'sabre', reason: 'timeout' | 'authentication' | 'quota' | 'unavailable'): MultiProviderAdapter => ({
      ...createPreparedAdapter({ id, displayName: id, domains: ['flight'] }),
      prepared: false,
      isConfigured: () => true,
      async search() {
        return {
          success: false,
          data: null,
          latencyMs: 5,
          reason,
          errorCode: reason.toUpperCase(),
        }
      },
    })

    const adapters: MultiProviderAdapter[] = [
      failing('duffel', 'timeout'),
      failing('travelport', 'authentication'),
      failing('sabre', 'quota'),
      {
        id: 'amadeus_enterprise',
        displayName: 'Amadeus Enterprise',
        domains: ['flight'],
        mocked: false,
        prepared: false,
        isConfigured: () => true,
        async search() {
          return {
            success: false,
            data: null,
            latencyMs: 3,
            reason: 'unavailable',
            errorCode: 'UNAVAILABLE',
          }
        },
      },
      createMockDomainAdapter('flight'),
    ]

    const result = await executeProviderChain({
      domain: 'flight',
      req: SAMPLE_REQ,
      adapters,
    })

    expect(result.success).toBe(true)
    expect(result.providerId).toBe('mock')
    expect(result.source).toBe('fallback')
    expect(result.fallbackCount).toBeGreaterThanOrEqual(4)
    expect(result.attempts.map((a) => a.reason)).toEqual([
      'timeout',
      'authentication',
      'quota',
      'unavailable',
      null,
    ])
  })
})

describe('Provider Health Monitor', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    vi.stubEnv('VITE_MULTI_PROVIDER_ENABLED', 'true')
    vi.stubEnv('VITE_FLIGHT_PROVIDER_CHAIN', '')
    resetProviderHealthMonitor()
    clearMultiProviderConfigCache()
    resetMultiProviderRegistry()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    clearMultiProviderConfigCache()
  })

  it('tracks connected, latency, errors, fallback count, quota', async () => {
    await executeProviderChain({ domain: 'flight', req: SAMPLE_REQ })
    const report = getProviderHealthMonitor().report(['flight'])
    const flight = report.domains[0]
    expect(flight.chain).toEqual(DEFAULT_FLIGHT_CHAIN)
    expect(flight.providers.length).toBe(DEFAULT_FLIGHT_CHAIN.length)

    const mock = flight.providers.find((p) => p.providerId === 'mock')
    expect(mock?.connected).toBe(true)
    expect(mock?.latencyMs).not.toBeNull()

    const duffel = flight.providers.find((p) => p.providerId === 'duffel')
    expect(duffel?.errors).toBeGreaterThanOrEqual(1)
    expect(duffel?.prepared).toBe(true)

    expect(report.totals.connected).toBeGreaterThanOrEqual(1)
    expect(typeof report.totals.fallbackCount).toBe('number')
    expect(mock?.quotaStatus === 'ok' || mock?.quotaStatus === 'unknown').toBe(true)
  })
})

describe('FlightService multi-provider integration', () => {
  beforeEach(() => {
    resetFlightService()
    resetProviderRegistry()
    clearConfigCache()
    clearMultiProviderConfigCache()
    resetMultiProviderRegistry()
    resetProviderHealthMonitor()
    vi.unstubAllEnvs()
  })

  afterEach(() => {
    resetFlightService()
    resetProviderRegistry()
    clearConfigCache()
    vi.unstubAllEnvs()
  })

  it('returns mock offers through the multi-provider chain without changing request shape', async () => {
    vi.stubEnv('VITE_MULTI_PROVIDER_ENABLED', 'true')
    vi.stubEnv('VITE_FLIGHT_PROVIDER_CHAIN', '')
    clearMultiProviderConfigCache()
    resetMultiProviderRegistry()
    resetFlightService()

    const service = createFlightService()
    const model = await service.searchFlights(SAMPLE_REQ)
    expect(model.offers.length).toBeGreaterThan(0)
    expect(['mock', 'fallback', 'real']).toContain(model.source)
    expect(model.providerId).toBe('mock')
  })

  it('preserves conversation-compatible FlightModel shape', async () => {
    vi.stubEnv('VITE_MULTI_PROVIDER_ENABLED', 'true')
    clearMultiProviderConfigCache()
    resetFlightService()
    const model = await createFlightService().searchFlights(SAMPLE_REQ)
    expect(model).toEqual(expect.objectContaining({
      source: expect.any(String),
      offers: expect.any(Array),
      latency: expect.any(Number),
      error: null,
    }))
  })
})
