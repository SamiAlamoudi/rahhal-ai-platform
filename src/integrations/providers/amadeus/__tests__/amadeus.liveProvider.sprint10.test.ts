/**
 * Sprint 10 — Live Amadeus flight provider (search, price, booking-ready).
 * Uses mocked fetch — no network, no secrets required.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AmadeusFlightAdapter,
  type AmadeusFlightAdapterConfig,
} from '../amadeusFlightAdapter'
import {
  AmadeusFlightApiClient,
  type AmadeusFlightOffer,
  type AmadeusFlightOffersResponse,
} from '../amadeusFlightApiClient'
import { AmadeusOAuthClient } from '../amadeusOAuthClient'
import { buildAmadeusFlightSearchQuery } from '../flightSearchModule'
import {
  buildAmadeusBookingReadyPayload,
  buildTravelerSlots,
} from '../bookingReadyPayload'
import { createFlightService, resetFlightService } from '../../flightService'
import { getProviderRegistry, resetProviderRegistry } from '../../../registry/providerRegistry'
import { clearConfigCache } from '../../../config/environment'
import type { ProviderRequest } from '../../../../utils/contracts/providers/base'
import type { TravelSearchRequest } from '../../../../utils/travelSearchRequest'

const TOKEN_URL = 'https://example.supabase.co/functions/v1/amadeus-token'
const INVOKE_KEY = 'test-anon-key'

function baseSearch(overrides: Partial<TravelSearchRequest> = {}): TravelSearchRequest {
  return {
    destination: 'Dubai',
    departureCity: 'Riyadh',
    departureDate: '2026-11-10',
    returnDate: '2026-11-20',
    durationDays: 10,
    travelPurpose: 'vacation',
    travelers: { adults: 2, children: 1, infants: 0, total: 3, type: 'family' },
    budgetAmount: 15000,
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
    familyFriendly: true,
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
    ...overrides,
  }
}

function providerRequest(search: TravelSearchRequest = baseSearch()): ProviderRequest {
  return { search }
}

const SAMPLE_OFFER: AmadeusFlightOffer = {
  type: 'flight-offer',
  id: 'OFFER-RT-1',
  source: 'GDS',
  instantTicketingRequired: false,
  nonHomogeneous: false,
  oneWay: false,
  lastTicketingDate: '2026-11-09',
  numberOfBookableSeats: 5,
  itineraries: [
    {
      duration: 'PT3H15M',
      segments: [
        {
          departure: { iataCode: 'RUH', at: '2026-11-10T08:00:00' },
          arrival: { iataCode: 'DXB', at: '2026-11-10T11:15:00' },
          carrierCode: 'SV',
          number: '568',
          aircraft: { code: '320' },
          duration: 'PT3H15M',
          id: '1',
          numberOfStops: 0,
        },
      ],
    },
    {
      duration: 'PT3H20M',
      segments: [
        {
          departure: { iataCode: 'DXB', at: '2026-11-20T14:00:00' },
          arrival: { iataCode: 'RUH', at: '2026-11-20T15:20:00' },
          carrierCode: 'SV',
          number: '569',
          aircraft: { code: '320' },
          duration: 'PT3H20M',
          id: '2',
          numberOfStops: 0,
        },
      ],
    },
  ],
  price: { currency: 'SAR', total: '2200.00', base: '1900.00' },
  pricingOptions: {
    fareType: 'PUBLISHED',
    includedCheckedBagsOnly: true,
    refundableFare: false,
    noRestrictionFare: false,
    noPenaltyFare: false,
    noChangeFees: false,
  },
  validatingAirlineCodes: ['SV'],
  travelerPricings: [
    {
      travelerId: 1,
      fareOption: 'STANDARD',
      travelerType: 'ADULT',
      price: { currency: 'SAR', total: '900.00', base: '800.00' },
      fareDetailsBySegment: [
        {
          segmentId: '1',
          cabin: 'ECONOMY',
          fareBasis: 'Y',
          class: 'Y',
          includedCheckedBags: { weight: 23, weightUnit: 'KG' },
        },
        {
          segmentId: '2',
          cabin: 'ECONOMY',
          fareBasis: 'Y',
          class: 'Y',
          includedCheckedBags: { weight: 23, weightUnit: 'KG' },
        },
      ],
    },
  ],
}

function adapterConfig(overrides: Partial<AmadeusFlightAdapterConfig> = {}): AmadeusFlightAdapterConfig {
  return {
    tokenUrl: TOKEN_URL,
    invokeApiKey: INVOKE_KEY,
    baseUrl: 'https://test.api.amadeus.com',
    timeout: 5000,
    maxRetries: 1,
    ...overrides,
  }
}

function mockTokenOk() {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      access_token: 'tok-test',
      token_type: 'Bearer',
      expires_in: 1799,
    }),
    text: async () => '',
  }
}

function mockOffersOk(offers: AmadeusFlightOffer[] = [SAMPLE_OFFER]) {
  const body: AmadeusFlightOffersResponse = {
    meta: { count: offers.length },
    data: offers,
    dictionaries: { carriers: { SV: 'Saudia' }, aircraft: { '320': 'A320' } },
  }
  return {
    ok: true,
    status: 200,
    json: async (): Promise<AmadeusFlightOffersResponse> => body,
    text: async (): Promise<string> => JSON.stringify(body),
  }
}

describe('Sprint 10 — Amadeus live flight query shaping', () => {
  it('builds round-trip query with adults, children, cabin, currency', async () => {
    const oauth = new AmadeusOAuthClient({
      tokenUrl: TOKEN_URL,
      invokeApiKey: INVOKE_KEY,
      timeout: 2000,
    })
    const api = new AmadeusFlightApiClient(
      { baseUrl: 'https://test.api.amadeus.com', timeout: 2000, maxRetries: 0 },
      oauth,
    )
    const built = await buildAmadeusFlightSearchQuery(api, baseSearch({
      preferredCabin: 'business',
      budgetCurrency: 'USD',
    }), { allowRemoteLookup: false })

    expect(built.query).toMatchObject({
      origin: 'RUH',
      destination: 'DXB',
      departureDate: '2026-11-10',
      returnDate: '2026-11-20',
      adults: 2,
      children: 1,
      cabin: 'BUSINESS',
      currency: 'USD',
    })
  })

  it('builds one-way query when returnDate is empty', async () => {
    const oauth = new AmadeusOAuthClient({
      tokenUrl: TOKEN_URL,
      invokeApiKey: INVOKE_KEY,
      timeout: 2000,
    })
    const api = new AmadeusFlightApiClient(
      { baseUrl: 'https://test.api.amadeus.com', timeout: 2000, maxRetries: 0 },
      oauth,
    )
    const built = await buildAmadeusFlightSearchQuery(
      api,
      baseSearch({ returnDate: '', travelers: { adults: 1, children: 0, infants: 0, total: 1, type: 'solo' } }),
      { allowRemoteLookup: false },
    )
    expect(built.query?.returnDate).toBeUndefined()
    expect(built.query?.adults).toBe(1)
    expect(built.query?.children).toBeUndefined()
  })
})

describe('Sprint 10 — Amadeus API client search params', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('sends returnDate, children, cabin, and currency on flight-offers', async () => {
    const fetchMock = vi.fn(async (url: RequestInfo) => {
      const u = String(url)
      if (u.includes('amadeus-token')) return mockTokenOk()
      return mockOffersOk()
    })
    vi.stubGlobal('fetch', fetchMock)

    const oauth = new AmadeusOAuthClient({
      tokenUrl: TOKEN_URL,
      invokeApiKey: INVOKE_KEY,
      timeout: 2000,
    })
    const api = new AmadeusFlightApiClient(
      { baseUrl: 'https://test.api.amadeus.com', timeout: 2000, maxRetries: 0 },
      oauth,
    )
    const result = await api.searchFlightOffers({
      origin: 'RUH',
      destination: 'DXB',
      departureDate: '2026-11-10',
      returnDate: '2026-11-20',
      adults: 2,
      children: 1,
      cabin: 'ECONOMY',
      currency: 'SAR',
    })
    expect(result.error).toBeNull()
    const offerUrl = String(
      fetchMock.mock.calls.find(([u]) => String(u).includes('flight-offers') && !String(u).includes('pricing'))![0],
    )
    expect(offerUrl).toContain('returnDate=2026-11-20')
    expect(offerUrl).toContain('children=1')
    expect(offerUrl).toContain('travelClass=ECONOMY')
    expect(offerUrl).toContain('currencyCode=SAR')
    expect(offerUrl).toContain('adults=2')
  })
})

describe('Sprint 10 — provider success, pricing, booking-ready', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('search succeeds and exposes baggage on normalized offers', async () => {
    const fetchMock = vi.fn(async (url: RequestInfo) => {
      const u = String(url)
      if (u.includes('amadeus-token')) return mockTokenOk()
      return mockOffersOk()
    })
    vi.stubGlobal('fetch', fetchMock)

    const adapter = new AmadeusFlightAdapter(adapterConfig())
    const result = await adapter.searchFlights(providerRequest())
    expect(result.success).toBe(true)
    expect(result.data?.[0]?.id).toBe('OFFER-RT-1')
    expect(result.data?.[0]?.currency).toBe('SAR')
    expect(result.data?.[0]?.itinerary.baggageIncluded).toBe(true)
    expect(result.data?.[0]?.itinerary.segments.length).toBe(1)
  })

  it('prices offer details and builds booking-ready payload without payment', async () => {
    const fetchMock = vi.fn(async (url: RequestInfo, init?: RequestInit) => {
      const u = String(url)
      if (u.includes('amadeus-token')) return mockTokenOk()
      if (u.includes('flight-offers/pricing')) {
        expect(init?.method).toBe('POST')
        const priced = {
          ...SAMPLE_OFFER,
          id: 'OFFER-RT-1-PRICED',
          price: { currency: 'SAR', total: '2250.00', base: '1950.00' },
        }
        return {
          ok: true,
          status: 200,
          json: async (): Promise<{
            data: { type: string; flightOffers: AmadeusFlightOffer[] }
            dictionaries: { carriers: Record<string, string> }
          }> => ({
            data: { type: 'flight-offers-pricing', flightOffers: [priced] },
            dictionaries: { carriers: { SV: 'Saudia' } },
          }),
          text: async (): Promise<string> => '',
        }
      }
      return mockOffersOk()
    })
    vi.stubGlobal('fetch', fetchMock)

    const adapter = new AmadeusFlightAdapter(adapterConfig())
    const search = await adapter.searchFlights(providerRequest())
    expect(search.success).toBe(true)

    const details = await adapter.getOfferDetails('OFFER-RT-1')
    expect(details.success).toBe(true)
    expect(details.data?.pricedFlightOffer.id).toBe('OFFER-RT-1-PRICED')
    expect(details.data?.offer.price).toBe(2250)
    expect(details.data?.bookingReady.kind).toBe('amadeus_flight_booking_ready')
    expect(details.data?.bookingReady.payment).toBeNull()
    expect(details.data?.bookingReady.travelerSlots).toEqual([
      { id: '1', travelerType: 'ADULT' },
      { id: '2', travelerType: 'ADULT' },
      { id: '3', travelerType: 'CHILD' },
    ])
    expect(details.data?.bookingReady.bookingUrl).toContain('offerId=OFFER-RT-1-PRICED')
  })

  it('buildTravelerSlots covers adults, children, infants', () => {
    expect(buildTravelerSlots({ adults: 1, children: 1, infants: 1 })).toEqual([
      { id: '1', travelerType: 'ADULT' },
      { id: '2', travelerType: 'CHILD' },
      { id: '3', travelerType: 'SEATED_INFANT' },
    ])
  })

  it('buildAmadeusBookingReadyPayload never includes payment fields', () => {
    const payload = buildAmadeusBookingReadyPayload({
      providerId: 'amadeus-flight-001',
      pricedFlightOffer: SAMPLE_OFFER,
      offer: {
        id: SAMPLE_OFFER.id,
        providerId: 'amadeus-flight-001',
        title: 'test',
        currency: 'SAR',
        price: 2200,
        originalPrice: null,
        rating: 4,
        itinerary: {
          segments: [],
          totalDuration: 0,
          stops: 0,
          refundable: false,
          baggageIncluded: true,
        },
        familyFriendly: true,
        cancellationPolicy: 'non-refundable',
      },
      adults: 2,
    })
    expect(payload.payment).toBeNull()
    expect(JSON.stringify(payload)).not.toMatch(/cardNumber|moyasar|paymentIntent/i)
  })
})

describe('Sprint 10 — failure modes', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('maps invalid credentials (401 from token proxy)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => ({ error: 'invalid', code: 'AMADEUS_INVALID_CREDENTIALS' }),
      text: async () => JSON.stringify({ error: 'invalid', code: 'AMADEUS_INVALID_CREDENTIALS' }),
    })))

    const adapter = new AmadeusFlightAdapter(adapterConfig())
    const result = await adapter.searchFlights(providerRequest(baseSearch({
      returnDate: '',
      travelers: { adults: 1, children: 0, infants: 0, total: 1, type: 'solo' },
    })))
    expect(result.success).toBe(false)
    expect(result.errors[0]?.code).toMatch(/AMADEUS_|TOKEN|AUTH|CREDENTIAL/i)
  })

  it('maps timeout on flight-offers', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: RequestInfo) => {
      if (String(url).includes('amadeus-token')) return mockTokenOk()
      throw new Error('The operation was aborted.')
    }))

    const oauth = new AmadeusOAuthClient({
      tokenUrl: TOKEN_URL,
      invokeApiKey: INVOKE_KEY,
      timeout: 50,
    })
    const api = new AmadeusFlightApiClient(
      { baseUrl: 'https://test.api.amadeus.com', timeout: 50, maxRetries: 0 },
      oauth,
    )
    const result = await api.searchFlightOffers({
      origin: 'RUH',
      destination: 'DXB',
      departureDate: '2026-11-10',
      adults: 1,
    })
    expect(result.error?.code).toBe('AMADEUS_TIMEOUT')
    expect(result.error?.retryable).toBe(true)
  })

  it('maps quota exceeded (403)', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: RequestInfo) => {
      if (String(url).includes('amadeus-token')) return mockTokenOk()
      return {
        ok: false,
        status: 403,
        json: async () => ({}),
        text: async () => 'Quota limit exceeded for this API key',
      }
    }))

    const oauth = new AmadeusOAuthClient({
      tokenUrl: TOKEN_URL,
      invokeApiKey: INVOKE_KEY,
      timeout: 2000,
    })
    const api = new AmadeusFlightApiClient(
      { baseUrl: 'https://test.api.amadeus.com', timeout: 2000, maxRetries: 0 },
      oauth,
    )
    const result = await api.searchFlightOffers({
      origin: 'RUH',
      destination: 'DXB',
      departureDate: '2026-11-10',
      adults: 1,
    })
    expect(result.error?.code).toBe('AMADEUS_QUOTA_EXCEEDED')
    expect(result.error?.retryable).toBe(false)
  })

  it('maps provider unavailable (404)', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: RequestInfo) => {
      if (String(url).includes('amadeus-token')) return mockTokenOk()
      return {
        ok: false,
        status: 404,
        json: async () => ({}),
        text: async () => 'not found',
      }
    }))

    const oauth = new AmadeusOAuthClient({
      tokenUrl: TOKEN_URL,
      invokeApiKey: INVOKE_KEY,
      timeout: 2000,
    })
    const api = new AmadeusFlightApiClient(
      { baseUrl: 'https://test.api.amadeus.com', timeout: 2000, maxRetries: 0 },
      oauth,
    )
    const result = await api.searchFlightOffers({
      origin: 'RUH',
      destination: 'DXB',
      departureDate: '2026-11-10',
      adults: 1,
    })
    expect(result.error?.code).toBe('AMADEUS_UNAVAILABLE')
  })
})

describe('Sprint 10 — provider chain fallback (Amadeus → Mock)', () => {
  beforeEach(() => {
    resetFlightService()
    resetProviderRegistry()
    clearConfigCache()
    vi.unstubAllEnvs()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    resetFlightService()
    resetProviderRegistry()
    clearConfigCache()
  })

  it('falls back to mock when live Amadeus fails', async () => {
    vi.stubEnv('VITE_FLIGHT_PROVIDER', 'amadeus')
    vi.stubEnv('VITE_AMADEUS_ENABLED', 'true')
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', INVOKE_KEY)
    vi.stubEnv('VITE_AMADEUS_BASE_URL', 'https://test.api.amadeus.com')

    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 503,
      json: async () => ({ error: 'down', code: 'AMADEUS_SERVER_NOT_CONFIGURED' }),
      text: async () => 'unavailable',
    })))

    // Force registry rebuild with env
    resetProviderRegistry()
    clearConfigCache()
    const registry = getProviderRegistry()
    expect(registry.getFlight()?.metadata.id).toBe('amadeus-flight-001')

    const service = createFlightService()
    const model = await service.searchFlights(providerRequest(baseSearch({
      returnDate: '',
      travelers: { adults: 1, children: 0, infants: 0, total: 1, type: 'solo' },
    })))
    expect(model.source).toBe('fallback')
    expect(model.offers.length).toBeGreaterThan(0)
    expect(model.error).toBeTruthy()
  })
})
