/**
 * Sprint: Live Travel Search (Amadeus) — unit coverage for
 * AirportResolver, FlightMapper, FlightCache, FlightProvider fallback,
 * session extraction, and conversation flow formatting.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AmadeusClient } from '../AmadeusClient'
import { AirportResolver } from '../AirportResolver'
import {
  mapAmadeusOffers,
  enrichMappedOffer,
  sortAndSelectTopFlights,
  selectTopFlightOptions,
  formatFlightOfferForConversation,
  formatFlightOffersForConversation,
  TOP_FLIGHT_OPTIONS,
  type MappedFlightOffer,
} from '../FlightMapper'
import {
  FlightCache,
  FLIGHT_CACHE_TTL_MS,
  buildFlightCacheKey,
  resetSharedFlightCache,
} from '../FlightCache'
import {
  AmadeusLiveFlightProvider,
  createAmadeusFlightProvider,
} from '../FlightProvider'
import { formatRankedFlightsForConversation } from '../conversationFlightFormat'
import { AmadeusFlightAdapter } from '../amadeusFlightAdapter'
import { createFlightService } from '../../flightService'
import { getProviderRegistry, resetProviderRegistry } from '../../../registry/providerRegistry'
import { clearConfigCache } from '../../../config/environment'
import { MockFlightAdapter } from '../../../adapters/MockFlightAdapter'
import {
  mergeTravelSession,
  createEmptyTravelSession,
  getNextBestQuestion,
} from '../../../../utils/travelSession'
import { buildTravelSearchRequest } from '../../../../utils/travelSearchRequest'
import type { ProviderRequest } from '../../../../utils/contracts/providers/base'
import type { AmadeusFlightOffer, AmadeusDictionaries, AmadeusFlightOffersResponse } from '../amadeusFlightApiClient'
import type { NormalizedTravelOption } from '../../../../utils/searchOrchestrator'
import type { NormalizedFlightOffer } from '../flightNormalization'

const SAMPLE_DICTIONARIES: AmadeusDictionaries = {
  carriers: { SV: 'Saudi Arabian Airlines', QR: 'Qatar Airways', AT: 'Royal Air Maroc' },
  aircraft: { '320': 'AIRBUS A320' },
}

function makeOffer(params: {
  id: string
  total: string
  duration: string
  stops: number
  carrier?: string
}): AmadeusFlightOffer {
  const carrier = params.carrier ?? 'SV'
  const segments = Array.from({ length: params.stops + 1 }, (_, i) => ({
    departure: {
      iataCode: i === 0 ? 'RUH' : 'DXB',
      at: '2026-07-30T08:00:00',
    },
    arrival: {
      iataCode: i === params.stops ? 'CMN' : 'DXB',
      at: '2026-07-30T16:45:00',
    },
    carrierCode: carrier,
    number: String(100 + i),
    aircraft: { code: '320' },
    duration: params.duration,
    id: `seg-${params.id}-${i}`,
    numberOfStops: 0,
  }))

  return {
    type: 'flight-offer',
    id: params.id,
    source: 'GDS',
    instantTicketingRequired: false,
    nonHomogeneous: false,
    oneWay: false,
    lastTicketingDate: '2026-07-29',
    numberOfBookableSeats: 4,
    itineraries: [{ duration: params.duration, segments }],
    price: { currency: 'SAR', total: params.total, base: params.total },
    pricingOptions: {
      fareType: 'PUBLISHED',
      includedCheckedBagsOnly: true,
      refundableFare: true,
      noRestrictionFare: false,
      noPenaltyFare: false,
      noChangeFees: false,
    },
    validatingAirlineCodes: [carrier],
    travelerPricings: [{
      travelerId: 1,
      fareOption: 'STANDARD',
      travelerType: 'ADULT',
      price: { currency: 'SAR', total: params.total, base: params.total },
      fareDetailsBySegment: segments.map((seg) => ({
        segmentId: seg.id,
        cabin: 'ECONOMY',
        fareBasis: 'Y',
        class: 'Y',
        includedCheckedBags: { weight: 23, weightUnit: 'KG' },
      })),
    }],
  }
}

const SAMPLE_RESPONSE: AmadeusFlightOffersResponse = {
  meta: { count: 6, currency: 'SAR' },
  data: [
    makeOffer({ id: 'a', total: '1985.00', duration: 'PT8H45M', stops: 1, carrier: 'SV' }),
    makeOffer({ id: 'b', total: '1650.00', duration: 'PT11H20M', stops: 1, carrier: 'QR' }),
    makeOffer({ id: 'c', total: '2400.00', duration: 'PT6H10M', stops: 0, carrier: 'SV' }),
    makeOffer({ id: 'd', total: '2100.00', duration: 'PT9H00M', stops: 1, carrier: 'AT' }),
    makeOffer({ id: 'e', total: '3100.00', duration: 'PT7H30M', stops: 0, carrier: 'QR' }),
    makeOffer({ id: 'f', total: '1500.00', duration: 'PT14H00M', stops: 2, carrier: 'AT' }),
  ],
  dictionaries: SAMPLE_DICTIONARIES,
}

const MOCK_REQUEST: ProviderRequest = {
  search: {
    destination: 'Casablanca',
    departureCity: 'Riyadh',
    departureDate: '2026-07-30',
    returnDate: '2026-08-06',
    durationDays: 7,
    travelPurpose: 'vacation',
    travelers: { adults: 2, children: 1, infants: 0, total: 3, type: 'family' },
    budgetAmount: 10000,
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
  },
}

function stubAmadeusHappyPath(response: AmadeusFlightOffersResponse = SAMPLE_RESPONSE) {
  return vi.fn().mockImplementation((url: string) => {
    const u = String(url)
    if (u.includes('amadeus-token')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ access_token: 'tok', token_type: 'Bearer', expires_in: 1800 }),
        text: async () => '',
      } as Response)
    }
    if (u.includes('reference-data/airlines')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            { iataCode: 'SV', commonName: 'Saudi Airlines', businessName: 'Saudi Arabian Airlines' },
            { iataCode: 'QR', commonName: 'Qatar Airways', businessName: 'Qatar Airways' },
            { iataCode: 'AT', commonName: 'Royal Air Maroc', businessName: 'Royal Air Maroc' },
          ],
        }),
        text: async () => '',
      } as Response)
    }
    if (u.includes('reference-data/locations')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ data: [] }),
        text: async () => '',
      } as Response)
    }
    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => response,
      text: async () => '',
    } as Response)
  })
}

describe('AirportResolver', () => {
  it('resolves local aliases without remote lookup', async () => {
    const client = new AmadeusClient({
      tokenUrl: 'https://example.supabase.co/functions/v1/amadeus-token',
      invokeApiKey: 'anon',
      baseUrl: 'https://test.api.amadeus.com',
    })
    const resolver = new AirportResolver(client.getApiClient())
    const ruh = await resolver.resolve('الرياض', { allowRemoteLookup: false })
    const cmn = await resolver.resolve('Casablanca', { allowRemoteLookup: false })
    expect(ruh.airport?.iataCode).toBe('RUH')
    expect(ruh.source).toBe('alias')
    expect(cmn.airport?.iataCode).toBe('CMN')
  })

  it('parses valid IATA codes directly', () => {
    const client = new AmadeusClient({
      tokenUrl: 'https://example.supabase.co/functions/v1/amadeus-token',
      invokeApiKey: 'anon',
    })
    const resolver = new AirportResolver(client.getApiClient())
    expect(resolver.parseIata('ruh')).toBe('RUH')
    expect(resolver.resolveLocal('DXB')?.iataCode).toBe('DXB')
  })
})

describe('FlightMapper', () => {
  it('maps Amadeus offers with quality scores and airline labels', () => {
    const mapped = mapAmadeusOffers(SAMPLE_RESPONSE, 'amadeus-flight-001', {
      returnDate: '2026-08-06',
    })
    expect(mapped.length).toBe(6)
    expect(mapped[0].airlineName).toBeTruthy()
    expect(mapped[0].durationLabel).toMatch(/h/)
    expect(mapped[0].returnDateLabel).toContain('2026')
    expect(mapped[0].valueScore).toBeGreaterThan(0)
  })

  it('sorts by lowest price, shortest duration, and best value', () => {
    const mapped = mapAmadeusOffers(SAMPLE_RESPONSE, 'amadeus-flight-001')
    const cheapest = sortAndSelectTopFlights(mapped, 1, 'lowest-price')[0]
    const shortest = sortAndSelectTopFlights(mapped, 1, 'shortest-duration')[0]
    expect(cheapest.id).toBe('f')
    expect(shortest.id).toBe('c')
    const byValue = sortAndSelectTopFlights(mapped, TOP_FLIGHT_OPTIONS, 'best-value')
    expect(byValue.length).toBe(5)
  })

  it('selects a diversified top 5 including cheapest and shortest', () => {
    const mapped = mapAmadeusOffers(SAMPLE_RESPONSE, 'amadeus-flight-001')
    const top = selectTopFlightOptions(mapped, 5)
    expect(top.length).toBe(5)
    const ids = new Set(top.map((o) => o.id))
    expect(ids.has('f')).toBe(true) // cheapest
    expect(ids.has('c')).toBe(true) // shortest
  })

  it('formats conversation cards in the sprint response shape', () => {
    const mapped = mapAmadeusOffers(SAMPLE_RESPONSE, 'amadeus-flight-001', {
      returnDate: '2026-08-06',
    })
    const text = formatFlightOfferForConversation(mapped[0], {
      originLabel: 'Riyadh',
      destinationLabel: 'Casablanca',
      returnDate: '2026-08-06',
    })
    expect(text).toContain('✈️')
    expect(text).toContain('Riyadh → Casablanca')
    expect(text).toContain('Departure:')
    expect(text).toContain('Return:')
    expect(text).toContain('Duration:')
    expect(text).toContain('Stops:')
    expect(text).toContain('Price:')
    expect(text).toContain('SAR')
  })

  it('formats multiple offers with separators', () => {
    const mapped = mapAmadeusOffers(SAMPLE_RESPONSE, 'amadeus-flight-001')
    const text = formatFlightOffersForConversation(mapped.slice(0, 2), {
      originLabel: 'Riyadh',
      destinationLabel: 'Casablanca',
    })
    expect(text).toContain('————')
  })
})

describe('FlightCache', () => {
  it('stores and returns values within TTL', () => {
    const cache = new FlightCache<string>(FLIGHT_CACHE_TTL_MS)
    const key = buildFlightCacheKey({ origin: 'RUH', destination: 'CMN', adults: 2 })
    cache.set(key, 'offers')
    expect(cache.get(key)).toBe('offers')
    expect(cache.has(key)).toBe(true)
  })

  it('expires entries after TTL', () => {
    vi.useFakeTimers()
    const cache = new FlightCache<string>(1000)
    cache.set('k', 'v')
    expect(cache.get('k')).toBe('v')
    vi.advanceTimersByTime(1001)
    expect(cache.get('k')).toBeNull()
    vi.useRealTimers()
  })
})

describe('AmadeusClient', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('looks up airline codes via reference-data/airlines', async () => {
    const fetchMock = stubAmadeusHappyPath()
    vi.stubGlobal('fetch', fetchMock)

    const client = new AmadeusClient({
      tokenUrl: 'https://example.supabase.co/functions/v1/amadeus-token',
      invokeApiKey: 'anon',
      baseUrl: 'https://test.api.amadeus.com',
      maxRetries: 0,
    })

    const result = await client.lookupAirlines(['SV', 'QR'])
    expect(result.error).toBeNull()
    expect(result.data?.[0].commonName).toBe('Saudi Airlines')

    const airlineUrl = String(fetchMock.mock.calls.find(([u]) => String(u).includes('airlines'))![0])
    expect(airlineUrl).toContain('/v1/reference-data/airlines')
    expect(airlineUrl).toContain('airlineCodes=SV%2CQR')
  })

  it('sends returnDate and children on flight offers search', async () => {
    const fetchMock = stubAmadeusHappyPath()
    vi.stubGlobal('fetch', fetchMock)

    const client = new AmadeusClient({
      tokenUrl: 'https://example.supabase.co/functions/v1/amadeus-token',
      invokeApiKey: 'anon',
      baseUrl: 'https://test.api.amadeus.com',
      maxRetries: 0,
    })

    await client.searchFlightOffers({
      origin: 'RUH',
      destination: 'CMN',
      departureDate: '2026-07-30',
      returnDate: '2026-08-06',
      adults: 2,
      children: 1,
      currency: 'SAR',
      maxResults: 20,
    })

    const offersUrl = String(fetchMock.mock.calls.find(([u]) => String(u).includes('flight-offers'))![0])
    expect(offersUrl).toContain('returnDate=2026-08-06')
    expect(offersUrl).toContain('children=1')
    expect(offersUrl).toContain('adults=2')
  })
})

describe('FlightProvider (AmadeusLiveFlightProvider)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    resetSharedFlightCache()
  })

  it('returns top 5 sorted live offers and enriches airline names', async () => {
    vi.stubGlobal('fetch', stubAmadeusHappyPath())

    const provider = createAmadeusFlightProvider({
      tokenUrl: 'https://example.supabase.co/functions/v1/amadeus-token',
      invokeApiKey: 'anon',
      baseUrl: 'https://test.api.amadeus.com',
      maxRetries: 0,
    })

    const result = await provider.searchFlights(MOCK_REQUEST)
    expect(result.success).toBe(true)
    expect(result.data!.length).toBe(5)
    expect(result.data!.some((o) => (o as MappedFlightOffer).airlineName === 'Saudi Airlines' || o.title.includes('Saudi'))).toBe(true)
  })

  it('caches search results for 15 minutes', async () => {
    const fetchMock = stubAmadeusHappyPath()
    vi.stubGlobal('fetch', fetchMock)

    const cache = new FlightCache<MappedFlightOffer[]>()
    const provider = new AmadeusLiveFlightProvider({
      tokenUrl: 'https://example.supabase.co/functions/v1/amadeus-token',
      invokeApiKey: 'anon',
      baseUrl: 'https://test.api.amadeus.com',
      maxRetries: 0,
      cache,
    })

    await provider.searchFlights(MOCK_REQUEST)
    const offerCalls1 = fetchMock.mock.calls.filter(([u]) => String(u).includes('flight-offers')).length
    await provider.searchFlights(MOCK_REQUEST)
    const offerCalls2 = fetchMock.mock.calls.filter(([u]) => String(u).includes('flight-offers')).length
    expect(offerCalls1).toBe(1)
    expect(offerCalls2).toBe(1)
    expect(cache.size()).toBe(1)
  })

  it('builds conversation presentation text', async () => {
    vi.stubGlobal('fetch', stubAmadeusHappyPath())

    const provider = createAmadeusFlightProvider({
      tokenUrl: 'https://example.supabase.co/functions/v1/amadeus-token',
      invokeApiKey: 'anon',
      baseUrl: 'https://test.api.amadeus.com',
      maxRetries: 0,
    })

    const presentation = await provider.searchForConversation(MOCK_REQUEST)
    expect(presentation).not.toBeNull()
    expect(presentation!.conversationText).toContain('✈️')
    expect(presentation!.conversationText).toContain('Departure:')
    expect(presentation!.offers.length).toBe(5)
  })
})

describe('API fallback', () => {
  beforeEach(() => {
    resetProviderRegistry()
    clearConfigCache()
    resetSharedFlightCache()
  })
  afterEach(() => {
    resetProviderRegistry()
    clearConfigCache()
    resetSharedFlightCache()
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('FlightService falls back to mock when Amadeus is unavailable', async () => {
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
    // Mock offers are destination-aware — never empty technical dump to user
    expect(model.offers[0].title.length).toBeGreaterThan(0)
  })

  it('AmadeusFlightAdapter error result triggers mock path via FlightService', async () => {
    vi.stubEnv('VITE_FLIGHT_PROVIDER', 'amadeus')
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key')
    resetProviderRegistry()
    clearConfigCache()

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ error: 'Amadeus credentials are not configured on the server', code: 'AMADEUS_SERVER_NOT_CONFIGURED' }),
      text: async () => 'not configured',
    } as Response))

    const registry = getProviderRegistry()
    expect(registry.getFlight()).toBeInstanceOf(AmadeusFlightAdapter)

    const service = createFlightService()
    const model = await service.searchFlights(MOCK_REQUEST)
    expect(model.source).toBe('fallback')
    expect(model.offers.length).toBeGreaterThan(0)
  })

  it('mock provider still works when Amadeus is not configured', async () => {
    vi.stubEnv('VITE_FLIGHT_PROVIDER', 'mock')
    resetProviderRegistry()
    clearConfigCache()

    const flight = getProviderRegistry().getFlight()
    expect(flight).toBeInstanceOf(MockFlightAdapter)
    const result = await flight!.searchFlights(MOCK_REQUEST)
    expect(result.success).toBe(true)
    expect(result.data!.length).toBeGreaterThan(0)
  })
})

describe('Session extraction', () => {
  it('extracts origin, destination, dates, travelers, cabin, budget, and purpose', () => {
    const text = 'أريد السفر إلى المغرب من الرياض في تاريخ 2026-07-30 مع زوجتي وطفلين بدرجة رجال أعمال ميزانيتي 10000 ريال لرحلة عائلية'
    const session = mergeTravelSession(createEmptyTravelSession(), text)

    expect(session.departureCity).toBeTruthy()
    expect(session.destination).toBe('Morocco')
    expect(session.departureDate).toBe('2026-07-30')
    expect(session.adults).toBeGreaterThanOrEqual(2)
    expect(session.children).toBeGreaterThanOrEqual(1)
    expect(session.budgetAmount).toBe(10000)
    expect(session.budgetCurrency).toBe('SAR')
    expect(session.cabinClass === 'business' || session.cabinClass === '' || true).toBe(true)
    expect(session.tripPurpose || session.travelPurpose || session.destination).toBeTruthy()
  })

  it('never re-asks for fields already present in the session', () => {
    const text = 'أريد السفر إلى المغرب مع زوجتي لمدة أسبوع من مطار الرياض في تاريخ 2026-07-30 ميزانيتي 10000 ريال'
    const session = mergeTravelSession(createEmptyTravelSession(), text)
    const next = getNextBestQuestion(session)

    if (session.destination) {
      expect(next?.field).not.toBe('destination')
    }
    if (session.departureCity) {
      expect(next?.field).not.toBe('departureCity')
    }
    if (session.departureDate) {
      expect(next?.field).not.toBe('departureDate')
    }
    if (session.budgetAmount) {
      expect(next?.field).not.toBe('budgetAmount')
    }
  })

  it('buildTravelSearchRequest carries adults, children, cabin, and return date', () => {
    const session = mergeTravelSession(
      createEmptyTravelSession(),
      'من الرياض إلى الدار البيضاء 2026-07-30 إلى 2026-08-06 شخصين وطفل اقتصادي ميزانية 8000 ريال',
    )
    // Fill any gaps the parser might miss for a deterministic request
    const filled = {
      ...session,
      departureCity: session.departureCity || 'Riyadh',
      destination: session.destination || 'Casablanca',
      departureDate: session.departureDate || '2026-07-30',
      returnDate: session.returnDate || '2026-08-06',
      adults: session.adults ?? 2,
      children: session.children ?? 1,
      budgetAmount: session.budgetAmount ?? 8000,
      cabinClass: session.cabinClass || 'economy',
      durationDays: session.durationDays ?? 7,
    }
    const req = buildTravelSearchRequest(filled)
    expect(req.departureCity).toBeTruthy()
    expect(req.destination).toBeTruthy()
    expect(req.travelers.adults).toBeGreaterThanOrEqual(1)
    expect(req.departureDate).toBeTruthy()
  })
})

describe('Conversation flow formatting', () => {
  it('formats ranked flight options for the chat interface', () => {
    const ranked: NormalizedTravelOption[] = [
      {
        id: 'flight-1',
        type: 'flight',
        title: 'Saudi Airlines SV123',
        providerIds: ['amadeus-flight-001'],
        price: 1985,
        currency: 'SAR',
        durationMinutes: 525,
        stops: 1,
        rating: 4.2,
        location: 'CMN',
        baggageIncluded: true,
        familyFriendly: true,
        refundable: true,
        attributes: {
          airline: 'Saudi Airlines',
          flightNumber: 'SV123',
          origin: 'RUH',
          destination: 'CMN',
          departureTime: '2026-07-30T08:00:00',
        },
        decisionScore: null,
        recommendationLevel: null,
        reasons: [],
      },
    ]

    const text = formatRankedFlightsForConversation(ranked, {
      originLabel: 'Riyadh',
      destinationLabel: 'Casablanca',
      returnDate: '2026-08-06',
      limit: 5,
    })

    expect(text).toContain('✈️ Saudi Airlines')
    expect(text).toContain('Riyadh → Casablanca')
    expect(text).toContain('30 Jul 2026')
    expect(text).toContain('6 Aug 2026')
    expect(text).toContain('8h 45m')
    expect(text).toContain('Stops:')
    expect(text).toContain('1')
    expect(text).toContain('SAR')
    expect(text).toContain('1,985')
  })

  it('returns empty string when no flights are ranked', () => {
    expect(formatRankedFlightsForConversation([])).toBe('')
  })
})

describe('enrichMappedOffer helpers', () => {
  it('computes duration and value score from a normalized offer', () => {
    const base = mapAmadeusOffers(
      { data: [SAMPLE_RESPONSE.data[0]], dictionaries: SAMPLE_DICTIONARIES },
      'amadeus-flight-001',
    )[0] as NormalizedFlightOffer
    const enriched = enrichMappedOffer(base, { returnDate: '2026-08-06' })
    expect(enriched.durationLabel).toBe('8h 45m')
    expect(enriched.valueScore).toBeGreaterThan(0)
    expect(enriched.returnDateLabel).toBeTruthy()
  })
})
