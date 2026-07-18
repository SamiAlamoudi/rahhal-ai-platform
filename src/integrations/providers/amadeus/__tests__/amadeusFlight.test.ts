import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AmadeusOAuthClient } from '../amadeusOAuthClient'
import { AmadeusFlightApiClient, type AmadeusFlightOffersResponse, type FlightSearchQuery } from '../amadeusFlightApiClient'
import { AmadeusFlightAdapter, type AmadeusFlightAdapterConfig } from '../amadeusFlightAdapter'
import {
  normalizeAmadeusResponse,
  normalizeAmadeusFlightOffer,
  mapCabin,
  parseDuration,
  computeFlightQuality,
} from '../flightNormalization'
import { createFlightService } from '../../flightService'
import { getProviderRegistry, resetProviderRegistry } from '../../../registry/providerRegistry'
import { clearConfigCache } from '../../../config/environment'
import { getProviderHealthService, resetHealthService } from '../../../health/providerHealth'
import type { ProviderRequest } from '../../../../utils/contracts/providers/base'
import type { AmadeusFlightOffer, AmadeusDictionaries } from '../amadeusFlightApiClient'

const MOCK_REQUEST: ProviderRequest = {
  search: {
    destination: 'Tokyo',
    departureCity: 'Riyadh',
    departureDate: '2026-10-15',
    returnDate: '2026-10-25',
    durationDays: 10,
    travelPurpose: 'vacation',
    travelers: { adults: 2, children: 0, infants: 0, total: 2, type: 'couple' },
    budgetAmount: 20000,
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

const SAMPLE_DICTIONARIES: AmadeusDictionaries = {
  carriers: { JL: 'JAL', QR: 'Qatar Airways', SV: 'Saudia' },
  aircraft: { '359': 'AIRBUS A350-900', '777': 'BOEING 777-300ER' },
}

const SAMPLE_OFFER: AmadeusFlightOffer = {
  type: 'flight-offer',
  id: 'offer-001',
  source: 'GDS',
  instantTicketingRequired: false,
  nonHomogeneous: false,
  oneWay: false,
  lastTicketingDate: '2026-10-14',
  numberOfBookableSeats: 4,
  itineraries: [
    {
      duration: 'PT10H30M',
      segments: [
        {
          departure: { iataCode: 'RUH', at: '2026-10-15T01:30:00' },
          arrival: { iataCode: 'NRT', at: '2026-10-15T17:30:00' },
          carrierCode: 'JL',
          number: '462',
          aircraft: { code: '359' },
          duration: 'PT10H30M',
          id: 'seg-1',
          numberOfStops: 0,
        },
      ],
    },
  ],
  price: { currency: 'SAR', total: '5500.00', base: '6500.00' },
  pricingOptions: {
    fareType: 'PUBLISHED',
    includedCheckedBagsOnly: true,
    refundableFare: true,
    noRestrictionFare: false,
    noPenaltyFare: false,
    noChangeFees: false,
  },
  validatingAirlineCodes: ['JL'],
  travelerPricings: [
    {
      travelerId: 1,
      fareOption: 'STANDARD',
      travelerType: 'ADULT',
      price: { currency: 'SAR', total: '5500.00', base: '6500.00' },
      fareDetailsBySegment: [
        {
          segmentId: 'seg-1',
          cabin: 'ECONOMY',
          fareBasis: 'YOW',
          class: 'M',
          includedCheckedBags: { weight: 23, weightUnit: 'KG' },
        },
      ],
    },
  ],
}

const SAMPLE_MULTI_STOP_OFFER: AmadeusFlightOffer = {
  ...SAMPLE_OFFER,
  id: 'offer-002',
  itineraries: [
    {
      duration: 'PT14H10M',
      segments: [
        {
          departure: { iataCode: 'RUH', at: '2026-10-15T08:00:00' },
          arrival: { iataCode: 'DOH', at: '2026-10-15T09:30:00' },
          carrierCode: 'QR',
          number: '1166',
          aircraft: { code: '777' },
          duration: 'PT1H30M',
          id: 'seg-a',
          numberOfStops: 0,
        },
        {
          departure: { iataCode: 'DOH', at: '2026-10-15T11:00:00' },
          arrival: { iataCode: 'NRT', at: '2026-10-15T22:10:00' },
          carrierCode: 'QR',
          number: '1166',
          aircraft: { code: '777' },
          duration: 'PT10H10M',
          id: 'seg-b',
          numberOfStops: 0,
        },
      ],
    },
  ],
  price: { currency: 'SAR', total: '4500.00', base: '4500.00' },
  pricingOptions: {
    fareType: 'PUBLISHED',
    includedCheckedBagsOnly: false,
    refundableFare: false,
    noRestrictionFare: false,
    noPenaltyFare: false,
    noChangeFees: false,
  },
  travelerPricings: [
    {
      travelerId: 1,
      fareOption: 'STANDARD',
      travelerType: 'ADULT',
      price: { currency: 'SAR', total: '4500.00', base: '4500.00' },
      fareDetailsBySegment: [
        { segmentId: 'seg-a', cabin: 'ECONOMY', fareBasis: 'NOR', class: 'Q' },
        { segmentId: 'seg-b', cabin: 'ECONOMY', fareBasis: 'NOR', class: 'Q' },
      ],
    },
  ],
}

const SAMPLE_RESPONSE: AmadeusFlightOffersResponse = {
  meta: { count: 2, currency: 'SAR' },
  data: [SAMPLE_OFFER, SAMPLE_MULTI_STOP_OFFER],
  dictionaries: SAMPLE_DICTIONARIES,
}

function mockFetch(response: Partial<Response>): ReturnType<typeof fetch> {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: async () => response,
    text: async () => '',
    ...response,
  } as Response)
}

function createAdapterConfig(overrides: Partial<AmadeusFlightAdapterConfig> = {}): AmadeusFlightAdapterConfig {
  return {
    tokenUrl: 'https://example.supabase.co/functions/v1/amadeus-token',
    invokeApiKey: 'test-anon-key',
    baseUrl: 'https://test.api.amadeus.com',
    timeout: 5000,
    maxRetries: 2,
    ...overrides,
  }
}

// ── OAuth Tests ──────────────────────────────────────────────────────────────

describe('AmadeusOAuthClient', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('obtains and caches a token', async () => {
    let calls = 0
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      calls++
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ access_token: 'token-123', token_type: 'Bearer', expires_in: 1800 }),
        text: async () => '',
      } as Response)
    }))

    const client = new AmadeusOAuthClient({
      tokenUrl: 'https://example.supabase.co/functions/v1/amadeus-token',
      invokeApiKey: 'test-anon-key',
      timeout: 5000,
    })

    const r1 = await client.getToken()
    expect(r1.token).not.toBeNull()
    expect(r1.token!.accessToken).toBe('token-123')
    expect(r1.fromCache).toBe(false)

    const r2 = await client.getToken()
    expect(r2.fromCache).toBe(true)
    expect(calls).toBe(1)
  })

  it('calls the server token proxy without transmitting Amadeus client secrets', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ access_token: 'tok', token_type: 'Bearer', expires_in: 1800 }),
      text: async () => '',
    } as Response)
    vi.stubGlobal('fetch', fetchMock)

    const client = new AmadeusOAuthClient({
      tokenUrl: 'https://example.supabase.co/functions/v1/amadeus-token',
      invokeApiKey: 'test-anon-key',
      timeout: 5000,
    })
    await client.getToken()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toContain('/functions/v1/amadeus-token')
    expect(String(url)).not.toContain('api.amadeus.com')
    const body = String(init.body ?? '')
    expect(body).not.toMatch(/client_secret/i)
    expect(body).not.toMatch(/client_id/i)
    const headers = init.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer test-anon-key')
    expect(headers.apikey).toBe('test-anon-key')
  })

  it('refreshes expired token automatically', async () => {
    let calls = 0
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      calls++
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ access_token: `token-${calls}`, token_type: 'Bearer', expires_in: 1 }),
        text: async () => '',
      } as Response)
    }))

    const client = new AmadeusOAuthClient({
      tokenUrl: 'https://example.supabase.co/functions/v1/amadeus-token',
      invokeApiKey: 'test-anon-key',
      timeout: 5000,
    })

    const r1 = await client.getToken()
    expect(r1.token!.accessToken).toBe('token-1')

    await new Promise(resolve => setTimeout(resolve, 2100))

    const r2 = await client.getToken()
    expect(r2.token!.accessToken).toBe('token-2')
    expect(r2.fromCache).toBe(false)
    expect(calls).toBe(2)
  })

  it('never requests a token unnecessarily — deduplicates concurrent requests', async () => {
    let calls = 0
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      calls++
      return new Promise(resolve => {
        setTimeout(() => resolve({
          ok: true,
          status: 200,
          json: async () => ({ access_token: 'token-x', token_type: 'Bearer', expires_in: 1800 }),
          text: async () => '',
        } as Response), 50)
      })
    }))

    const client = new AmadeusOAuthClient({
      tokenUrl: 'https://example.supabase.co/functions/v1/amadeus-token',
      invokeApiKey: 'test-anon-key',
      timeout: 5000,
    })

    const [r1, r2, r3] = await Promise.all([
      client.getToken(),
      client.getToken(),
      client.getToken(),
    ])

    expect(r1.token!.accessToken).toBe('token-x')
    expect(r2.token!.accessToken).toBe('token-x')
    expect(r3.token!.accessToken).toBe('token-x')
    expect(calls).toBe(1)
  })

  it('returns error on 401 invalid credentials', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({}),
      text: async () => 'Unauthorized',
    } as Response))

    const client = new AmadeusOAuthClient({
      tokenUrl: 'https://example.supabase.co/functions/v1/amadeus-token',
      invokeApiKey: 'test-anon-key',
      timeout: 5000,
    })

    const result = await client.getToken()
    expect(result.token).toBeNull()
    expect(result.error!.code).toBe('AMADEUS_INVALID_CREDENTIALS')
    expect(result.error!.retryable).toBe(false)
  })

  it('returns error on 429 quota exceeded', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({}),
      text: async () => 'Too many requests',
    } as Response))

    const client = new AmadeusOAuthClient({
      tokenUrl: 'https://example.supabase.co/functions/v1/amadeus-token',
      invokeApiKey: 'test-anon-key',
      timeout: 5000,
    })

    const result = await client.getToken()
    expect(result.error!.code).toBe('AMADEUS_QUOTA_EXCEEDED')
    expect(result.error!.retryable).toBe(true)
  })

  it('returns error on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    const client = new AmadeusOAuthClient({
      tokenUrl: 'https://example.supabase.co/functions/v1/amadeus-token',
      invokeApiKey: 'test-anon-key',
      timeout: 5000,
    })

    const result = await client.getToken()
    expect(result.error!.code).toBe('AMADEUS_AUTH_NETWORK')
  })

  it('tracks token status and remaining lifetime', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ access_token: 'token-lt', token_type: 'Bearer', expires_in: 1800 }),
      text: async () => '',
    } as Response))

    const client = new AmadeusOAuthClient({
      tokenUrl: 'https://example.supabase.co/functions/v1/amadeus-token',
      invokeApiKey: 'test-anon-key',
      timeout: 5000,
    })

    expect(client.getTokenStatus()).toBe('none')
    expect(client.getTokenRemainingLifetime()).toBe(0)

    await client.getToken()

    expect(client.getTokenStatus()).toBe('valid')
    expect(client.getTokenRemainingLifetime()).toBeGreaterThan(0)
  })

  it('clearToken forces next request to fetch new token', async () => {
    let calls = 0
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      calls++
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ access_token: `t-${calls}`, token_type: 'Bearer', expires_in: 1800 }),
        text: async () => '',
      } as Response)
    }))

    const client = new AmadeusOAuthClient({
      tokenUrl: 'https://example.supabase.co/functions/v1/amadeus-token',
      invokeApiKey: 'test-anon-key',
      timeout: 5000,
    })

    await client.getToken()
    client.clearToken()
    const r = await client.getToken()
    expect(r.token!.accessToken).toBe('t-2')
    expect(calls).toBe(2)
  })
})

// ── Flight Search Tests ──────────────────────────────────────────────────────

describe('AmadeusFlightApiClient', () => {
  afterEach(() => vi.unstubAllGlobals())

  function stubTokenAndOffers(offers: AmadeusFlightOffersResponse) {
    let tokenCalls = 0
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (String(url).includes('amadeus-token')) {
        tokenCalls++
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ access_token: 'tok', token_type: 'Bearer', expires_in: 1800 }),
          text: async () => '',
        } as Response)
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => offers,
        text: async () => '',
      } as Response)
    }))
    return () => tokenCalls
  }

  it('searches flight offers with valid token', async () => {
    const getTokenCalls = stubTokenAndOffers(SAMPLE_RESPONSE)

    const oauth = new AmadeusOAuthClient({
      tokenUrl: 'https://example.supabase.co/functions/v1/amadeus-token',
      invokeApiKey: 'test-anon-key',
      timeout: 5000,
    })
    const api = new AmadeusFlightApiClient({
      baseUrl: 'https://test.api.amadeus.com',
      timeout: 5000,
      maxRetries: 2,
    }, oauth)

    const query: FlightSearchQuery = {
      origin: 'RUH', destination: 'NRT',
      departureDate: '2026-10-15', adults: 2,
      currency: 'SAR', maxResults: 10,
    }

    const result = await api.searchFlightOffers(query)
    expect(result.data).not.toBeNull()
    expect(result.data!.data.length).toBe(2)
    expect(result.error).toBeNull()
    expect(getTokenCalls()).toBe(1)
  })

  it('uses official /v1 shopping and location path prefixes', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes('amadeus-token')) {
        return Promise.resolve({
          ok: true, status: 200,
          json: async () => ({ access_token: 'tok', token_type: 'Bearer', expires_in: 1800 }),
          text: async () => '',
        } as Response)
      }
      return Promise.resolve({
        ok: true, status: 200,
        json: async () => SAMPLE_RESPONSE,
        text: async () => '',
      } as Response)
    })
    vi.stubGlobal('fetch', fetchMock)

    const oauth = new AmadeusOAuthClient({
      tokenUrl: 'https://example.supabase.co/functions/v1/amadeus-token',
      invokeApiKey: 'test-anon-key',
      timeout: 5000,
    })
    const api = new AmadeusFlightApiClient({
      baseUrl: 'https://test.api.amadeus.com',
      timeout: 5000,
      maxRetries: 0,
    }, oauth)

    await api.searchFlightOffers({
      origin: 'RUH', destination: 'NRT',
      departureDate: '2026-10-15', adults: 1,
    })
    await api.searchLocations('Dubai')

    const offerUrl = String(fetchMock.mock.calls.find(([u]) => String(u).includes('flight-offers'))![0])
    const locationUrl = String(fetchMock.mock.calls.find(([u]) => String(u).includes('reference-data/locations'))![0])
    expect(offerUrl).toContain('https://test.api.amadeus.com/v1/shopping/flight-offers')
    expect(locationUrl).toContain('https://test.api.amadeus.com/v1/reference-data/locations')
  })

  it('reuses cached token across multiple searches', async () => {
    const getTokenCalls = stubTokenAndOffers(SAMPLE_RESPONSE)

    const oauth = new AmadeusOAuthClient({
      tokenUrl: 'https://example.supabase.co/functions/v1/amadeus-token',
      invokeApiKey: 'test-anon-key',
      timeout: 5000,
    })
    const api = new AmadeusFlightApiClient({
      baseUrl: 'https://test.api.amadeus.com',
      timeout: 5000,
      maxRetries: 2,
    }, oauth)

    await api.searchFlightOffers({ origin: 'RUH', destination: 'NRT', departureDate: '2026-10-15', adults: 1 })
    await api.searchFlightOffers({ origin: 'JFK', destination: 'LHR', departureDate: '2026-10-16', adults: 1 })

    expect(getTokenCalls()).toBe(1)
  })

  it('refreshes token on 401 and retries', async () => {
    let tokenCalls = 0
    let searchCalls = 0
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (String(url).includes('amadeus-token')) {
        tokenCalls++
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ access_token: `tok-${tokenCalls}`, token_type: 'Bearer', expires_in: 1800 }),
          text: async () => '',
        } as Response)
      }
      searchCalls++
      if (searchCalls === 1) {
        return Promise.resolve({ ok: false, status: 401, json: async () => ({}), text: async () => 'Expired' } as Response)
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => SAMPLE_RESPONSE, text: async () => '' } as Response)
    }))

    const oauth = new AmadeusOAuthClient({
      tokenUrl: 'https://example.supabase.co/functions/v1/amadeus-token',
      invokeApiKey: 'test-anon-key',
      timeout: 5000,
    })
    const api = new AmadeusFlightApiClient({
      baseUrl: 'https://test.api.amadeus.com',
      timeout: 5000,
      maxRetries: 2,
    }, oauth)

    const result = await api.searchFlightOffers({
      origin: 'RUH', destination: 'NRT',
      departureDate: '2026-10-15', adults: 1,
    })

    expect(result.data).not.toBeNull()
    expect(result.tokenRefreshed).toBe(true)
    expect(tokenCalls).toBe(2)
  })

  it('retries on 500 server error', async () => {
    let tokenCalls = 0
    let searchCalls = 0
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (String(url).includes('amadeus-token')) {
        tokenCalls++
        return Promise.resolve({
          ok: true, status: 200,
          json: async () => ({ access_token: 'tok', token_type: 'Bearer', expires_in: 1800 }),
          text: async () => '',
        } as Response)
      }
      searchCalls++
      if (searchCalls < 3) {
        return Promise.resolve({ ok: false, status: 500, json: async () => ({}), text: async () => 'Server error' } as Response)
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => SAMPLE_RESPONSE, text: async () => '' } as Response)
    }))

    const oauth = new AmadeusOAuthClient({
      tokenUrl: 'https://example.supabase.co/functions/v1/amadeus-token',
      invokeApiKey: 'test-anon-key',
      timeout: 5000,
    })
    const api = new AmadeusFlightApiClient({
      baseUrl: 'https://test.api.amadeus.com',
      timeout: 5000,
      maxRetries: 2,
    }, oauth)

    const result = await api.searchFlightOffers({
      origin: 'RUH', destination: 'NRT',
      departureDate: '2026-10-15', adults: 1,
    })

    expect(result.data).not.toBeNull()
    expect(result.attempts).toBe(3)
  })

  it('returns error on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (String(url).includes('amadeus-token')) {
        return Promise.resolve({
          ok: true, status: 200,
          json: async () => ({ access_token: 'tok', token_type: 'Bearer', expires_in: 1800 }),
          text: async () => '',
        } as Response)
      }
      return Promise.reject(new TypeError('Failed to fetch'))
    }))

    const oauth = new AmadeusOAuthClient({
      tokenUrl: 'https://example.supabase.co/functions/v1/amadeus-token',
      invokeApiKey: 'test-anon-key',
      timeout: 5000,
    })
    const api = new AmadeusFlightApiClient({
      baseUrl: 'https://test.api.amadeus.com',
      timeout: 5000,
      maxRetries: 0,
    }, oauth)

    const result = await api.searchFlightOffers({
      origin: 'RUH', destination: 'NRT',
      departureDate: '2026-10-15', adults: 1,
    })

    expect(result.data).toBeNull()
    expect(result.error!.code).toBe('AMADEUS_NETWORK_FAILURE')
  })
})

// ── Normalization Tests ──────────────────────────────────────────────────────

describe('Flight Normalization', () => {
  it('maps cabin codes correctly', () => {
    expect(mapCabin('ECONOMY')).toBe('economy')
    expect(mapCabin('PREMIUM_ECONOMY')).toBe('premium-economy')
    expect(mapCabin('BUSINESS')).toBe('business')
    expect(mapCabin('FIRST')).toBe('first')
    expect(mapCabin(undefined)).toBe('economy')
    expect(mapCabin('UNKNOWN')).toBe('economy')
  })

  it('parses ISO 8601 durations', () => {
    expect(parseDuration('PT10H30M')).toBe(630)
    expect(parseDuration('PT1H30M')).toBe(90)
    expect(parseDuration('PT45M')).toBe(45)
    expect(parseDuration('PT2H')).toBe(120)
    expect(parseDuration('invalid')).toBe(0)
  })

  it('computes flight quality scores', () => {
    const direct = computeFlightQuality(600, 0, 'business', true)
    expect(direct.travelTimeScore).toBe(85)
    expect(direct.overallFlightQuality).toBeGreaterThanOrEqual(100)

    const longLayover = computeFlightQuality(1200, 2, 'economy', false)
    expect(longLayover.travelTimeScore).toBe(55)
    expect(longLayover.overallFlightQuality).toBeLessThan(60)
  })

  it('normalizes a direct flight offer', () => {
    const offer = normalizeAmadeusFlightOffer(SAMPLE_OFFER, SAMPLE_DICTIONARIES, 'amadeus-flight-001')
    expect(offer.id).toBe('offer-001')
    expect(offer.providerId).toBe('amadeus-flight-001')
    expect(offer.currency).toBe('SAR')
    expect(offer.price).toBe(5500)
    expect(offer.originalPrice).toBe(6500)
    expect(offer.itinerary.segments.length).toBe(1)
    expect(offer.itinerary.stops).toBe(0)
    expect(offer.itinerary.totalDuration).toBe(630)
    expect(offer.itinerary.baggageIncluded).toBe(true)
    expect(offer.itinerary.refundable).toBe(true)
    expect(offer.bookingClass).toBe('M')
    expect(offer.travelTimeScore).toBeGreaterThan(0)
    expect(offer.overallFlightQuality).toBeGreaterThan(0)
    expect(offer.bookingUrl).toContain('offerId=offer-001')
    expect(offer.bookingUrl).toContain('env=sandbox')
  })

  it('normalizes a multi-stop flight offer', () => {
    const offer = normalizeAmadeusFlightOffer(SAMPLE_MULTI_STOP_OFFER, SAMPLE_DICTIONARIES, 'amadeus-flight-001')
    expect(offer.itinerary.segments.length).toBe(2)
    expect(offer.itinerary.stops).toBe(1)
    expect(offer.itinerary.totalDuration).toBe(850)
    expect(offer.itinerary.baggageIncluded).toBe(false)
    expect(offer.itinerary.refundable).toBe(false)
    expect(offer.price).toBe(4500)
    expect(offer.originalPrice).toBeNull()
  })

  it('normalizes a full response', () => {
    const offers = normalizeAmadeusResponse(SAMPLE_RESPONSE, 'amadeus-flight-001')
    expect(offers.length).toBe(2)
    expect(offers[0].id).toBe('offer-001')
    expect(offers[1].id).toBe('offer-002')
  })

  it('handles empty response data', () => {
    const offers = normalizeAmadeusResponse({ data: [], dictionaries: SAMPLE_DICTIONARIES }, 'test')
    expect(offers.length).toBe(0)
  })

  it('handles missing dictionaries gracefully', () => {
    const offer = normalizeAmadeusFlightOffer(SAMPLE_OFFER, undefined, 'amadeus-flight-001')
    expect(offer.itinerary.segments[0].carrier).toBe('JL')
    expect(offer.itinerary.segments[0].aircraft).toBe('359')
  })

  it('builds a readable title with carrier name', () => {
    const offer = normalizeAmadeusFlightOffer(SAMPLE_OFFER, SAMPLE_DICTIONARIES, 'amadeus-flight-001')
    expect(offer.title).toContain('JAL')
    expect(offer.title).toContain('RUH')
    expect(offer.title).toContain('NRT')
    expect(offer.title).toContain('مباشر')
  })
})

// ── Adapter Tests ────────────────────────────────────────────────────────────

describe('AmadeusFlightAdapter', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('returns successful ProviderResult with FlightOffer[]', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (String(url).includes('amadeus-token')) {
        return Promise.resolve({
          ok: true, status: 200,
          json: async () => ({ access_token: 'tok', token_type: 'Bearer', expires_in: 1800 }),
          text: async () => '',
        } as Response)
      }
      return mockFetch({ json: async () => SAMPLE_RESPONSE } as Partial<Response>)
    }))

    const adapter = new AmadeusFlightAdapter(createAdapterConfig())
    const result = await adapter.searchFlights(MOCK_REQUEST)

    expect(result.success).toBe(true)
    expect(result.data).not.toBeNull()
    expect(result.data!.length).toBe(2)
    expect(result.source).toBe('amadeus')
    expect(result.providerId).toBe('amadeus-flight-001')
  })

  it('returns error result when credentials are invalid', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 401,
      json: async () => ({}), text: async () => 'Unauthorized',
    } as Response))

    const adapter = new AmadeusFlightAdapter(createAdapterConfig())
    const result = await adapter.searchFlights(MOCK_REQUEST)

    expect(result.success).toBe(false)
    expect(result.data).toBeNull()
    expect(result.errors[0].code).toBe('AMADEUS_INVALID_CREDENTIALS')
  })

  it('has correct metadata', () => {
    const adapter = new AmadeusFlightAdapter(createAdapterConfig())
    expect(adapter.metadata.type).toBe('flight')
    expect(adapter.metadata.id).toBe('amadeus-flight-001')
  })

  it('returns capabilities with multi-city support', () => {
    const adapter = new AmadeusFlightAdapter(createAdapterConfig())
    const caps = adapter.getCapabilities()
    expect(caps.supportsMultiCity).toBe(true)
    expect(caps.supportsPriceTracking).toBe(true)
  })
})

// ── Fallback Tests ───────────────────────────────────────────────────────────

describe('FlightService Fallback', () => {
  beforeEach(() => {
    resetProviderRegistry()
    clearConfigCache()
  })
  afterEach(() => {
    resetProviderRegistry()
    clearConfigCache()
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('falls back to mock when Amadeus auth fails', async () => {
    vi.stubEnv('VITE_FLIGHT_PROVIDER', 'amadeus')
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key')
    resetProviderRegistry()
    clearConfigCache()

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 401,
      json: async () => ({}), text: async () => 'Unauthorized',
    } as Response))

    const service = createFlightService()
    const model = await service.searchFlights(MOCK_REQUEST)

    expect(model.source).toBe('fallback')
    expect(model.offers.length).toBeGreaterThan(0)
    expect(model.error).not.toBeNull()
  })

  it('falls back to mock on network failure', async () => {
    vi.stubEnv('VITE_FLIGHT_PROVIDER', 'amadeus')
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key')
    resetProviderRegistry()
    clearConfigCache()

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    const service = createFlightService()
    const model = await service.searchFlights(MOCK_REQUEST)

    expect(model.source).toBe('fallback')
    expect(model.offers.length).toBeGreaterThan(0)
  })

  it('falls back to mock on quota exceeded', async () => {
    vi.stubEnv('VITE_FLIGHT_PROVIDER', 'amadeus')
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key')
    resetProviderRegistry()
    clearConfigCache()

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 429,
      json: async () => ({}), text: async () => 'Too many requests',
    } as Response))

    const service = createFlightService()
    const model = await service.searchFlights(MOCK_REQUEST)

    expect(model.source).toBe('fallback')
    expect(model.offers.length).toBeGreaterThan(0)
  })

  it('returns mock source by default when registry uses mock', async () => {
    const service = createFlightService()
    const model = await service.searchFlights(MOCK_REQUEST)

    expect(model.source).toBe('mock')
    expect(model.offers.length).toBeGreaterThan(0)
    expect(model.error).toBeNull()
  })

  it('returns real data when Amadeus succeeds', async () => {
    vi.stubEnv('VITE_FLIGHT_PROVIDER', 'amadeus')
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key')
    resetProviderRegistry()
    clearConfigCache()

    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (String(url).includes('amadeus-token')) {
        return Promise.resolve({
          ok: true, status: 200,
          json: async () => ({ access_token: 'tok', token_type: 'Bearer', expires_in: 1800 }),
          text: async () => '',
        } as Response)
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => SAMPLE_RESPONSE, text: async () => "" } as Response)
    }))

    const service = createFlightService()
    const model = await service.searchFlights(MOCK_REQUEST)

    expect(model.source).toBe('real')
    expect(model.offers.length).toBe(2)
    expect(model.error).toBeNull()
    expect(model.offers.every((o) => typeof o.bookingUrl === 'string' && o.bookingUrl.includes('offerId='))).toBe(true)
  })
})

// ── Registry Tests ───────────────────────────────────────────────────────────

describe('Provider Registry — Flight', () => {
  beforeEach(() => {
    resetProviderRegistry()
    clearConfigCache()
  })
  afterEach(() => {
    resetProviderRegistry()
    clearConfigCache()
    vi.unstubAllEnvs()
  })

  it('returns MockFlightAdapter by default', () => {
    const registry = getProviderRegistry()
    const flight = registry.getFlight()
    expect(flight).not.toBeNull()
    expect(flight!.metadata.id).toBe('mock-flight-001')
  })

  it('returns AmadeusFlightAdapter when amadeus is configured', () => {
    vi.stubEnv('VITE_FLIGHT_PROVIDER', 'amadeus')
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key')
    resetProviderRegistry()
    clearConfigCache()

    const registry = getProviderRegistry()
    const flight = registry.getFlight()
    expect(flight).not.toBeNull()
    expect(flight!.metadata.id).toBe('amadeus-flight-001')
  })

  it('auto-enables AmadeusFlightAdapter when token proxy is configured (no explicit adapter)', () => {
    vi.stubEnv('VITE_AMADEUS_ENABLED', 'true')
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key')
    resetProviderRegistry()
    clearConfigCache()

    const registry = getProviderRegistry()
    const flight = registry.getFlight()
    expect(flight).not.toBeNull()
    expect(flight!.metadata.id).toBe('amadeus-flight-001')
  })

  it('uses same-origin Vercel proxy when Amadeus is enabled without Supabase', () => {
    vi.stubEnv('VITE_FLIGHT_PROVIDER', 'amadeus')
    vi.stubEnv('VITE_AMADEUS_USE_VERCEL_PROXY', 'true')
    vi.stubEnv('VITE_SUPABASE_URL', '')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')
    vi.stubEnv('VITE_AMADEUS_TOKEN_URL', '')
    resetProviderRegistry()
    clearConfigCache()

    const registry = getProviderRegistry()
    const flight = registry.getFlight()
    expect(flight).not.toBeNull()
    expect(flight!.metadata.id).toBe('amadeus-flight-001')
  })

  it('returns null for amadeus when all token proxies are disabled', () => {
    vi.stubEnv('VITE_FLIGHT_PROVIDER', 'amadeus')
    vi.stubEnv('VITE_AMADEUS_USE_VERCEL_PROXY', 'false')
    vi.stubEnv('VITE_SUPABASE_URL', '')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')
    vi.stubEnv('VITE_AMADEUS_TOKEN_URL', '')
    resetProviderRegistry()
    clearConfigCache()

    const registry = getProviderRegistry()
    expect(registry.getFlight()).toBeNull()
  })

  it('can disable flight provider', () => {
    vi.stubEnv('VITE_FLIGHT_ENABLED', 'false')
    resetProviderRegistry()
    clearConfigCache()

    const registry = getProviderRegistry()
    expect(registry.getFlight()).toBeNull()
    expect(registry.isEnabled('flight')).toBe(false)
  })
})

// ── Diagnostics Tests ────────────────────────────────────────────────────────

describe('Diagnostics — Flight', () => {
  beforeEach(() => {
    resetProviderRegistry()
    clearConfigCache()
    resetHealthService()
  })
  afterEach(() => {
    resetProviderRegistry()
    clearConfigCache()
    resetHealthService()
    vi.unstubAllEnvs()
  })

  it('reports mock mode for default flight provider', () => {
    const service = getProviderHealthService()
    const all = service.checkAll()
    const flight = all.find((h: { domain: string }) => h.domain === 'flight')
    expect(flight).toBeDefined()
    expect(flight!.mode).toBe('mock')
    expect(flight!.adapter).toBe('mock')
    expect(flight!.oauthStatus).toBe('none')
    expect(flight!.tokenRemainingLifetime).toBeNull()
  })

  it('reports real mode and OAuth status for Amadeus', () => {
    vi.stubEnv('VITE_FLIGHT_PROVIDER', 'amadeus')
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key')
    resetProviderRegistry()
    clearConfigCache()
    resetHealthService()

    const service = getProviderHealthService()
    const flight = service.checkByDomain('flight')
    expect(flight).toBeDefined()
    expect(flight!.mode).toBe('real')
    expect(flight!.adapter).toBe('amadeus')
    expect(flight!.oauthStatus).toBe('none')
    expect(flight!.tokenRemainingLifetime).toBeNull()
  })

  it('reports not-configured OAuth when token proxy is missing', () => {
    vi.stubEnv('VITE_FLIGHT_PROVIDER', 'amadeus')
    vi.stubEnv('VITE_AMADEUS_USE_VERCEL_PROXY', 'false')
    vi.stubEnv('VITE_SUPABASE_URL', '')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')
    vi.stubEnv('VITE_AMADEUS_TOKEN_URL', '')
    resetProviderRegistry()
    clearConfigCache()
    resetHealthService()

    const service = getProviderHealthService()
    const flight = service.checkByDomain('flight')
    expect(flight).toBeNull()
  })
})
