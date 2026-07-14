import { describe, it, expect, vi, afterEach } from 'vitest'
import { AmadeusOAuthClient } from '../amadeusOAuthClient'
import { AmadeusFlightApiClient } from '../amadeusFlightApiClient'
import {
  parseValidIata,
  normalizeAirportQuery,
  resolveAirportAlias,
  pickBestLocation,
  resolveAirportCode,
} from '../airportResolution'
import { buildAmadeusFlightSearchQuery, mapCabinForApi } from '../flightSearchModule'
import { AmadeusFlightAdapter } from '../amadeusFlightAdapter'
import type { TravelSearchRequest } from '../../../../utils/travelSearchRequest'
import type { ProviderRequest } from '../../../../utils/contracts/providers/base'

function mockResponse(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
    text: async () => JSON.stringify(data),
  } as Response
}

function createClient() {
  const oauth = new AmadeusOAuthClient({
    tokenUrl: 'https://example.supabase.co/functions/v1/amadeus-token',
    invokeApiKey: 'test-anon-key',
    timeout: 5000,
  })
  return new AmadeusFlightApiClient({
    baseUrl: 'https://test.api.amadeus.com',
    timeout: 5000,
    maxRetries: 0,
  }, oauth)
}

const SAMPLE_SEARCH: TravelSearchRequest = {
  destination: 'طوكيو',
  departureCity: 'الرياض',
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
  hotelStars: 0,
  hotelBudget: 0,
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
}

describe('airportResolution — local mapping', () => {
  it('parses valid IATA codes', () => {
    expect(parseValidIata('ruh')).toBe('RUH')
    expect(parseValidIata('TYO')).toBe('TYO')
    expect(parseValidIata('Tokyo')).toBeNull()
    expect(parseValidIata('الرياض')).toBeNull()
  })

  it('maps Arabic cities to IATA without network', () => {
    expect(resolveAirportAlias('الرياض')?.iataCode).toBe('RUH')
    expect(resolveAirportAlias('طوكيو')?.iataCode).toBe('TYO')
    expect(resolveAirportAlias('دبي')?.iataCode).toBe('DXB')
    expect(normalizeAirportQuery('اليابان')).toBe('TYO')
  })

  it('does not invent RUH/NRT for unknown cities', () => {
    expect(resolveAirportAlias('SomeUnknownCityXYZ')).toBeNull()
  })

  it('prefers CITY over AIRPORT when picking Amadeus results', () => {
    const picked = pickBestLocation([
      { iataCode: 'NRT', subType: 'AIRPORT', name: 'NARITA' },
      { iataCode: 'TYO', subType: 'CITY', name: 'TOKYO' },
    ], 'Tokyo')
    expect(picked?.iataCode).toBe('TYO')
    expect(picked?.subType).toBe('CITY')
  })
})

describe('AmadeusFlightApiClient.searchLocations', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('calls reference-data/locations with OAuth bearer token', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes('amadeus-token')) {
        return Promise.resolve(mockResponse({
          access_token: 'tok',
          token_type: 'Bearer',
          expires_in: 1799,
        }))
      }
      return Promise.resolve(mockResponse({
        data: [{ iataCode: 'DXB', subType: 'CITY', name: 'DUBAI' }],
      }))
    })
    vi.stubGlobal('fetch', fetchMock)

    const client = createClient()
    const result = await client.searchLocations('Dubai')
    expect(result.error).toBeNull()
    expect(result.data?.[0].iataCode).toBe('DXB')

    const locationCall = fetchMock.mock.calls.find(([u]) => String(u).includes('reference-data/locations'))
    expect(locationCall).toBeTruthy()
    expect(String(locationCall![0])).toContain('/v1/reference-data/locations')
    expect(String(locationCall![0])).toContain('keyword=Dubai')
    const headers = locationCall![1].headers as Record<string, string>
    expect(headers.Authorization).toContain('Bearer tok')
  })
})

describe('resolveAirportCode + buildAmadeusFlightSearchQuery', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('builds RUH→TYO query from Arabic cities using aliases (no remote call)', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const client = createClient()

    const built = await buildAmadeusFlightSearchQuery(client, SAMPLE_SEARCH, { allowRemoteLookup: false })
    expect(built.query?.origin).toBe('RUH')
    expect(built.query?.destination).toBe('TYO')
    expect(built.errors).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('resolves origin and destination remotely concurrently', async () => {
    let inFlightLocations = 0
    let maxInFlightLocations = 0
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (String(url).includes('amadeus-token')) {
        return mockResponse({ access_token: 'tok', token_type: 'Bearer', expires_in: 1800 })
      }
      inFlightLocations++
      maxInFlightLocations = Math.max(maxInFlightLocations, inFlightLocations)
      await new Promise((r) => setTimeout(r, 40))
      inFlightLocations--
      const keyword = new URL(String(url)).searchParams.get('keyword') ?? ''
      if (keyword.includes('OriginRemote')) {
        return mockResponse({ data: [{ iataCode: 'JED', subType: 'CITY', name: 'JEDDAH' }] })
      }
      return mockResponse({ data: [{ iataCode: 'CAI', subType: 'CITY', name: 'CAIRO' }] })
    })
    vi.stubGlobal('fetch', fetchMock)

    const client = createClient()
    const built = await buildAmadeusFlightSearchQuery(
      client,
      { ...SAMPLE_SEARCH, departureCity: 'OriginRemoteXYZ', destination: 'DestRemoteXYZ' },
      { allowRemoteLookup: true },
    )

    expect(built.query?.origin).toBe('JED')
    expect(built.query?.destination).toBe('CAI')
    const locationCalls = fetchMock.mock.calls.filter(([u]) => String(u).includes('/v1/reference-data/locations'))
    expect(locationCalls.length).toBe(2)
    expect(maxInFlightLocations).toBeGreaterThanOrEqual(2)
  })

  it('fail-closes when origin cannot be resolved (no hard-coded RUH)', async () => {
    const client = createClient()
    const built = await buildAmadeusFlightSearchQuery(
      client,
      { ...SAMPLE_SEARCH, departureCity: 'مدينة-غير-معروفة', destination: 'طوكيو' },
      { allowRemoteLookup: false },
    )
    expect(built.query).toBeNull()
    expect(built.errors.some((e) => e.code.includes('AIRPORT'))).toBe(true)
  })

  it('uses remote Amadeus locations when alias is missing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (String(url).includes('amadeus-token')) {
        return Promise.resolve(mockResponse({
          access_token: 'tok', token_type: 'Bearer', expires_in: 1800,
        }))
      }
      return Promise.resolve(mockResponse({
        data: [{ iataCode: 'KIX', subType: 'AIRPORT', name: 'KANSAI' }],
      }))
    }))

    const client = createClient()
    const resolved = await resolveAirportCode(client, 'KansaiRegionXYZ', { allowRemoteLookup: true })
    expect(resolved.source).toBe('amadeus')
    expect(resolved.airport?.iataCode).toBe('KIX')
  })

  it('maps cabin preferences for Amadeus API', () => {
    expect(mapCabinForApi('business')).toBe('BUSINESS')
    expect(mapCabinForApi('')).toBeUndefined()
  })
})

describe('AmadeusFlightAdapter + flight search module', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('searches flight-offers with resolved IATA codes from Arabic cities', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes('amadeus-token')) {
        return Promise.resolve(mockResponse({
          access_token: 'tok', token_type: 'Bearer', expires_in: 1800,
        }))
      }
      if (String(url).includes('reference-data/locations')) {
        throw new Error('should not remote-lookup when aliases exist')
      }
      return Promise.resolve(mockResponse({
        meta: { count: 1 },
        data: [{
          type: 'flight-offer',
          id: '1',
          source: 'GDS',
          instantTicketingRequired: false,
          nonHomogeneous: false,
          oneWay: true,
          lastTicketingDate: '2026-10-14',
          numberOfBookableSeats: 2,
          itineraries: [{
            duration: 'PT10H',
            segments: [{
              departure: { iataCode: 'RUH', at: '2026-10-15T01:00:00' },
              arrival: { iataCode: 'NRT', at: '2026-10-15T17:00:00' },
              carrierCode: 'SV',
              number: '100',
              duration: 'PT10H',
              id: '1',
              numberOfStops: 0,
            }],
          }],
          price: { currency: 'SAR', total: '4000', base: '3500' },
          validatingAirlineCodes: ['SV'],
        }],
        dictionaries: { carriers: { SV: 'Saudia' } },
      }))
    })
    vi.stubGlobal('fetch', fetchMock)

    const adapter = new AmadeusFlightAdapter({
      tokenUrl: 'https://example.supabase.co/functions/v1/amadeus-token',
      invokeApiKey: 'test-anon-key',
      baseUrl: 'https://test.api.amadeus.com',
      timeout: 5000,
      maxRetries: 0,
    })

    const req: ProviderRequest = { search: SAMPLE_SEARCH }
    const result = await adapter.searchFlights(req)
    expect(result.success).toBe(true)
    expect(result.data?.length).toBe(1)

    const offersCall = fetchMock.mock.calls.find(([u]) => String(u).includes('flight-offers'))
    expect(offersCall).toBeTruthy()
    expect(String(offersCall![0])).toContain('originLocationCode=RUH')
    expect(String(offersCall![0])).toContain('destinationLocationCode=TYO')
  })
})
