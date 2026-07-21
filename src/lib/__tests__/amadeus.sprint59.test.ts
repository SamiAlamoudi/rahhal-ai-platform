/**
 * Sprint 59 — Real Flight Provider Integration (Amadeus)
 * All network calls mocked via injectable fetch — no external I/O.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import {
  AmadeusOAuthManager,
  AmadeusProviderError,
  amadeusTokenUrl,
  createAmadeusLiveProvider,
  createProviderRequestId,
  hasAmadeusCredentials,
  isLiveProviderEnabled,
  isLiveProvidersEnabled,
  logProviderRequest,
  mapCabinToAmadeusTravelClass,
  normalizeAmadeusLiveFlightOffer,
  parseDurationMinutes,
  readAmadeusApiKey,
  readAmadeusApiSecret,
  setProviderLogSink,
  type LiveFetch,
  type ProviderLogEntry,
} from '../agent/liveProviders'
import { readAmadeusCredentials } from '../../../api/_lib/amadeusEnv.js'
import {
  getDefaultBookingProviderRegistry,
  resetDefaultBookingProviderRegistry,
} from '../agent/bookingIntelligence/orchestrator'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function textResponse(body: string, status: number): Response {
  return new Response(body, { status, headers: { 'Content-Type': 'text/plain' } })
}

const SAMPLE_OFFER = {
  id: 'OFF-RUH-DXB-1',
  price: { total: '1180.50', currency: 'SAR' },
  pricingOptions: { refundableFare: true },
  travelerPricings: [
    {
      fareDetailsBySegment: [{ cabin: 'ECONOMY' }],
    },
  ],
  itineraries: [
    {
      duration: 'PT3H25M',
      segments: [
        {
          departure: { iataCode: 'RUH', at: '2026-09-10T08:15:00' },
          arrival: { iataCode: 'DXB', at: '2026-09-10T11:40:00' },
          carrierCode: 'SV',
          numberOfStops: 0,
        },
      ],
    },
  ],
}

describe('Sprint 59 — Amadeus real flight provider', () => {
  const logs: ProviderLogEntry[] = []

  beforeEach(() => {
    resetFeatureRegistry()
    resetDefaultBookingProviderRegistry()
    logs.length = 0
    setProviderLogSink((entry) => {
      logs.push(entry)
    })
  })

  afterEach(() => {
    setProviderLogSink(null)
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    resetFeatureRegistry()
    resetDefaultBookingProviderRegistry()
  })

  describe('credentials (env only)', () => {
    it('reads AMADEUS_API_KEY / AMADEUS_API_SECRET', () => {
      const result = readAmadeusCredentials({
        AMADEUS_API_KEY: 'api-key',
        AMADEUS_API_SECRET: 'api-secret',
      })
      expect(result.hasCredentials).toBe(true)
      expect(result.clientId).toBe('api-key')
      expect(result.clientSecret).toBe('api-secret')
    })

    it('falls back to AMADEUS_CLIENT_ID / AMADEUS_CLIENT_SECRET aliases', () => {
      const result = readAmadeusCredentials({
        AMADEUS_CLIENT_ID: 'legacy-id',
        AMADEUS_CLIENT_SECRET: 'legacy-secret',
      })
      expect(result.hasCredentials).toBe(true)
      expect(result.clientId).toBe('legacy-id')
    })

    it('prefers API_KEY over CLIENT_ID when both present', () => {
      const result = readAmadeusCredentials({
        AMADEUS_API_KEY: 'preferred',
        AMADEUS_API_SECRET: 'preferred-secret',
        AMADEUS_CLIENT_ID: 'legacy',
        AMADEUS_CLIENT_SECRET: 'legacy-secret',
      })
      expect(result.clientId).toBe('preferred')
      expect(result.clientSecret).toBe('preferred-secret')
    })

    it('hasAmadeusCredentials uses process env aliases', () => {
      vi.stubEnv('AMADEUS_API_KEY', 'k')
      vi.stubEnv('AMADEUS_API_SECRET', 's')
      expect(hasAmadeusCredentials()).toBe(true)
      expect(readAmadeusApiKey()).toBe('k')
      expect(readAmadeusApiSecret()).toBe('s')
    })
  })

  describe('OAuth token management', () => {
    it('retrieves and caches access tokens', async () => {
      let seq = 0
      const fetchImpl: LiveFetch = vi.fn(async () => {
        seq += 1
        return jsonResponse({
          access_token: `tok_${seq}`,
          expires_in: 3600,
          token_type: 'Bearer',
        })
      })
      const oauth = new AmadeusOAuthManager({
        clientId: 'api-key',
        clientSecret: 'api-secret',
        tokenUrl: amadeusTokenUrl('https://test.api.amadeus.com'),
        fetchImpl,
      })
      const first = await oauth.getToken()
      expect(first.token?.accessToken).toBe('tok_1')
      expect(first.fromCache).toBe(false)
      const cached = await oauth.getToken()
      expect(cached.fromCache).toBe(true)
      expect(cached.token?.accessToken).toBe('tok_1')
      expect(fetchImpl).toHaveBeenCalledTimes(1)
    })

    it('refreshes before expiry skew', async () => {
      let now = 1_000_000
      let seq = 0
      const fetchImpl: LiveFetch = vi.fn(async () => {
        seq += 1
        return jsonResponse({
          access_token: `tok_${seq}`,
          expires_in: 90,
          token_type: 'Bearer',
        })
      })
      const oauth = new AmadeusOAuthManager({
        clientId: 'api-key',
        clientSecret: 'api-secret',
        tokenUrl: amadeusTokenUrl('https://test.api.amadeus.com'),
        fetchImpl,
        refreshSkewMs: 60_000,
        now: () => now,
      })
      await oauth.getToken()
      expect(oauth.getStatus()).toBe('valid')
      // Advance close to expiry (within 60s skew of 90s TTL).
      now += 40_000
      expect(oauth.getStatus()).toBe('expired')
      const refreshed = await oauth.getToken()
      expect(refreshed.fromCache).toBe(false)
      expect(refreshed.token?.accessToken).toBe('tok_2')
    })

    it('retries authorized fetch once on 401', async () => {
      let tokenSeq = 0
      const fetchImpl: LiveFetch = vi.fn(async (input, init) => {
        const url = String(input)
        if (url.includes('/oauth2/token')) {
          tokenSeq += 1
          return jsonResponse({
            access_token: `tok_${tokenSeq}`,
            expires_in: 3600,
            token_type: 'Bearer',
          })
        }
        const auth = String((init?.headers as Record<string, string>)?.Authorization ?? '')
        if (auth.includes('tok_1')) return textResponse('unauthorized', 401)
        return jsonResponse({ data: [] })
      })
      const oauth = new AmadeusOAuthManager({
        clientId: 'api-key',
        clientSecret: 'api-secret',
        tokenUrl: amadeusTokenUrl('https://test.api.amadeus.com'),
        fetchImpl,
      })
      const { response, authRetried } = await oauth.authorizedFetch(
        'https://test.api.amadeus.com/v2/shopping/flight-offers',
      )
      expect(authRetried).toBe(true)
      expect(response.ok).toBe(true)
      expect(oauth.getAuthRetryCount()).toBe(1)
      expect(oauth.getRefreshCount()).toBe(1)
    })
  })

  describe('flight search', () => {
    it('successful search returns normalized Rahhal flight offers', async () => {
      const fetchImpl: LiveFetch = vi.fn(async (input) => {
        const url = String(input)
        if (url.includes('/oauth2/token')) {
          return jsonResponse({ access_token: 'tok', expires_in: 3600, token_type: 'Bearer' })
        }
        if (url.includes('/flight-offers')) {
          expect(url).toContain('originLocationCode=RUH')
          expect(url).toContain('destinationLocationCode=DXB')
          expect(url).toContain('departureDate=2026-09-10')
          expect(url).toContain('returnDate=2026-09-17')
          expect(url).toContain('adults=2')
          expect(url).toContain('children=1')
          expect(url).toContain('travelClass=BUSINESS')
          expect(url).toContain('currencyCode=SAR')
          return jsonResponse({ data: [SAMPLE_OFFER] })
        }
        throw new Error(`unexpected ${url}`)
      })

      const amadeus = createAmadeusLiveProvider({
        clientId: 'api-key',
        clientSecret: 'api-secret',
        baseUrl: 'https://test.api.amadeus.com',
        fetchImpl,
      })

      const offers = await amadeus.searchFlights!({
        origin: 'ruh',
        destination: 'dxb',
        departureDate: '2026-09-10',
        returnDate: '2026-09-17',
        adults: 2,
        children: 1,
        cabin: 'business',
        currency: 'sar',
      })

      expect(offers).toHaveLength(1)
      expect(offers[0]).toMatchObject({
        id: 'OFF-RUH-DXB-1',
        providerId: 'amadeus',
        from: 'RUH',
        to: 'DXB',
        airline: 'SV',
        cabin: 'ECONOMY',
        stops: 0,
        durationMinutes: 205,
        price: { amount: 1180.5, currency: 'SAR' },
        refundable: true,
      })
      expect(logs.some((l) => l.provider === 'amadeus' && l.status === 'ok')).toBe(true)
      expect(logs[0]?.requestId).toMatch(/^amd_/)
      expect(typeof logs[0]?.durationMs).toBe('number')
    })

    it('empty search returns [] without throwing', async () => {
      const fetchImpl: LiveFetch = vi.fn(async (input) => {
        const url = String(input)
        if (url.includes('/oauth2/token')) {
          return jsonResponse({ access_token: 'tok', expires_in: 3600, token_type: 'Bearer' })
        }
        return jsonResponse({ data: [] })
      })
      const amadeus = createAmadeusLiveProvider({
        clientId: 'api-key',
        clientSecret: 'api-secret',
        fetchImpl,
      })
      await expect(
        amadeus.searchFlights!({
          origin: 'RUH',
          destination: 'DXB',
          departureDate: '2026-09-10',
        }),
      ).resolves.toEqual([])
      expect(logs.some((l) => l.status === 'empty')).toBe(true)
    })

    it('invalid airport returns [] gracefully', async () => {
      const fetchImpl: LiveFetch = vi.fn(async (input) => {
        const url = String(input)
        if (url.includes('/oauth2/token')) {
          return jsonResponse({ access_token: 'tok', expires_in: 3600, token_type: 'Bearer' })
        }
        return textResponse('Invalid originLocationCode / unknown airport', 400)
      })
      const amadeus = createAmadeusLiveProvider({
        clientId: 'api-key',
        clientSecret: 'api-secret',
        fetchImpl,
      })
      await expect(
        amadeus.searchFlights!({
          origin: 'XXX',
          destination: 'YYY',
          departureDate: '2026-09-10',
        }),
      ).resolves.toEqual([])
      expect(logs.some((l) => l.status === 'invalid_airport')).toBe(true)
    })

    it('rate limit throws typed AmadeusProviderError', async () => {
      const fetchImpl: LiveFetch = vi.fn(async (input) => {
        const url = String(input)
        if (url.includes('/oauth2/token')) {
          return jsonResponse({ access_token: 'tok', expires_in: 3600, token_type: 'Bearer' })
        }
        return textResponse('quota exceeded', 429)
      })
      const amadeus = createAmadeusLiveProvider({
        clientId: 'api-key',
        clientSecret: 'api-secret',
        fetchImpl,
      })
      await expect(
        amadeus.searchFlights!({
          origin: 'RUH',
          destination: 'DXB',
          departureDate: '2026-09-10',
        }),
      ).rejects.toMatchObject({
        name: 'AmadeusProviderError',
        code: 'rate_limit',
        httpStatus: 429,
        retryable: true,
      })
      expect(logs.some((l) => l.status === 'rate_limit')).toBe(true)
    })

    it('provider unavailable (5xx) throws typed error', async () => {
      const fetchImpl: LiveFetch = vi.fn(async (input) => {
        const url = String(input)
        if (url.includes('/oauth2/token')) {
          return jsonResponse({ access_token: 'tok', expires_in: 3600, token_type: 'Bearer' })
        }
        return textResponse('upstream down', 503)
      })
      const amadeus = createAmadeusLiveProvider({
        clientId: 'api-key',
        clientSecret: 'api-secret',
        fetchImpl,
      })
      await expect(
        amadeus.searchFlights!({
          origin: 'RUH',
          destination: 'DXB',
          departureDate: '2026-09-10',
        }),
      ).rejects.toBeInstanceOf(AmadeusProviderError)
      await expect(
        amadeus.searchFlights!({
          origin: 'RUH',
          destination: 'DXB',
          departureDate: '2026-09-10',
        }),
      ).rejects.toMatchObject({ code: 'provider_unavailable' })
    })

    it('expired token after 401 retry surfaces expired_token', async () => {
      const fetchImpl: LiveFetch = vi.fn(async (input) => {
        const url = String(input)
        if (url.includes('/oauth2/token')) {
          return jsonResponse({ access_token: 'tok', expires_in: 3600, token_type: 'Bearer' })
        }
        return textResponse('unauthorized', 401)
      })
      const amadeus = createAmadeusLiveProvider({
        clientId: 'api-key',
        clientSecret: 'api-secret',
        fetchImpl,
      })
      await expect(
        amadeus.searchFlights!({
          origin: 'RUH',
          destination: 'DXB',
          departureDate: '2026-09-10',
        }),
      ).rejects.toMatchObject({ code: 'expired_token' })
      expect(logs.some((l) => l.status === 'expired_token')).toBe(true)
    })
  })

  describe('mapping', () => {
    it('maps cabin hints to Amadeus travelClass', () => {
      expect(mapCabinToAmadeusTravelClass('economy')).toBe('ECONOMY')
      expect(mapCabinToAmadeusTravelClass('Premium Economy')).toBe('PREMIUM_ECONOMY')
      expect(mapCabinToAmadeusTravelClass('business')).toBe('BUSINESS')
      expect(mapCabinToAmadeusTravelClass('FIRST')).toBe('FIRST')
      expect(mapCabinToAmadeusTravelClass(null)).toBeNull()
    })

    it('parses ISO-8601 durations', () => {
      expect(parseDurationMinutes('PT3H25M')).toBe(205)
      expect(parseDurationMinutes('PT2H')).toBe(120)
      expect(parseDurationMinutes('PT45M')).toBe(45)
      expect(parseDurationMinutes(undefined)).toBeNull()
    })

    it('normalizes Amadeus offer payload into LiveFlightOffer', () => {
      const mapped = normalizeAmadeusLiveFlightOffer(SAMPLE_OFFER, 0)
      expect(mapped).toEqual({
        id: 'OFF-RUH-DXB-1',
        providerId: 'amadeus',
        from: 'RUH',
        to: 'DXB',
        airline: 'SV',
        cabin: 'ECONOMY',
        stops: 0,
        durationMinutes: 205,
        departureAt: '2026-09-10T08:15:00',
        arrivalAt: '2026-09-10T11:40:00',
        price: { amount: 1180.5, currency: 'SAR' },
        refundable: true,
        raw: SAMPLE_OFFER,
      })
    })
  })

  describe('logging', () => {
    it('never logs secret material', () => {
      logProviderRequest({
        requestId: createProviderRequestId('amd'),
        provider: 'amadeus',
        operation: 'searchFlights',
        durationMs: 12,
        status: 'error',
        detail: 'failed Authorization: Bearer supersecrettoken api_key=abc123',
      })
      expect(logs[0]?.detail).not.toMatch(/supersecrettoken|abc123/i)
      expect(logs[0]?.detail).toContain('[redacted]')
      expect(logs[0]?.provider).toBe('amadeus')
    })
  })

  describe('mock remains configurable', () => {
    it('keeps live Amadeus OFF by default so mock providers stay selected', () => {
      const registry = getFeatureRegistry()
      expect(registry.isEnabled('ai.live_providers')).toBe(false)
      expect(registry.isEnabled('provider.amadeus')).toBe(false)
      expect(isLiveProvidersEnabled()).toBe(false)
      expect(isLiveProviderEnabled('amadeus')).toBe(false)

      const booking = getDefaultBookingProviderRegistry()
      const flightProviders = booking.forDomain('flights')
      expect(flightProviders.some((p) => p.providerId.startsWith('sim-'))).toBe(true)
      expect(flightProviders.every((p) => !p.providerId.startsWith('amadeus:'))).toBe(true)
    })
  })
})
