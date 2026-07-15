import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  BookingComApiClient,
  normalizeDestinationPayload,
} from '../bookingComApiClient'
import {
  normalizeDestinationQuery,
  parseNumericDestId,
  pickBestDestination,
  mapDestType,
  resolveBookingDestination,
} from '../destinationResolution'
import { BookingComAdapter } from '../bookingComAdapter'
import type { ProviderRequest } from '../../../../utils/contracts/providers/base'
import type { BookingComSearchResponse } from '../bookingComApiClient'

function mockFetchResponse(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
    text: async () => JSON.stringify(data),
  } as Response
}

const SAMPLE_DESTINATIONS = {
  status: true,
  data: [
    {
      dest_id: '-246227',
      search_type: 'city',
      dest_type: 'city',
      label: 'Tokyo, Japan',
      city_name: 'Tokyo',
      country: 'Japan',
    },
    {
      dest_id: '-999001',
      search_type: 'airport',
      label: 'Narita Airport',
    },
  ],
}

describe('normalizeDestinationQuery', () => {
  it('maps Arabic Tokyo / Japan labels to English Tokyo', () => {
    expect(normalizeDestinationQuery('طوكيو')).toBe('Tokyo')
    expect(normalizeDestinationQuery('اليابان')).toBe('Tokyo')
  })

  it('maps Dubai / Riyadh Arabic labels', () => {
    expect(normalizeDestinationQuery('دبي')).toBe('Dubai')
    expect(normalizeDestinationQuery('الرياض')).toBe('Riyadh')
  })

  it('passes through unknown destinations unchanged', () => {
    expect(normalizeDestinationQuery('Kyoto')).toBe('Kyoto')
  })
})

describe('parseNumericDestId', () => {
  it('parses positive and negative dest ids', () => {
    expect(parseNumericDestId('-246227')).toBe(-246227)
    expect(parseNumericDestId('12345')).toBe(12345)
  })

  it('returns null for city names', () => {
    expect(parseNumericDestId('Tokyo')).toBeNull()
    expect(parseNumericDestId('طوكيو')).toBeNull()
  })
})

describe('pickBestDestination / mapDestType', () => {
  it('prefers city over airport', () => {
    const picked = pickBestDestination(SAMPLE_DESTINATIONS.data, 'Tokyo')
    expect(picked?.destId).toBe(-246227)
    expect(picked?.destType).toBe('city')
    expect(picked?.label).toContain('Tokyo')
  })

  it('maps dest type strings', () => {
    expect(mapDestType('CITY')).toBe('city')
    expect(mapDestType('AIRPORT')).toBe('airport')
    expect(mapDestType('district')).toBe('district')
  })

  it('normalizes nested RapidAPI payloads', () => {
    const nested = normalizeDestinationPayload({ data: { data: SAMPLE_DESTINATIONS.data } })
    expect(nested.length).toBe(2)
  })
})

describe('BookingComApiClient.searchDestination', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('calls /hotels/searchDestination with query and RapidAPI headers', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockFetchResponse(SAMPLE_DESTINATIONS))
    vi.stubGlobal('fetch', fetchMock)

    const client = new BookingComApiClient({
      apiKey: 'test-key',
      baseUrl: 'https://booking-com15.p.rapidapi.com/api/v1',
      rapidApiHost: 'booking-com15.p.rapidapi.com',
      timeout: 5000,
      maxRetries: 0,
    })

    const result = await client.searchDestination('Dubai')
    expect(result.error).toBeNull()
    expect(result.data?.length).toBe(2)

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/hotels/searchDestination?')
    expect(url).toContain('query=Dubai')
    const headers = init.headers as Record<string, string>
    expect(headers['X-RapidAPI-Key']).toBe('test-key')
    expect(headers['X-RapidAPI-Host']).toBe('booking-com15.p.rapidapi.com')
  })

  it('returns error on 401 without throwing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse({ message: 'Unauthorized' }, 401)))
    const client = new BookingComApiClient({
      apiKey: 'bad',
      baseUrl: 'https://test.api.com/api/v1',
      rapidApiHost: 'booking-com15.p.rapidapi.com',
      timeout: 5000,
      maxRetries: 0,
    })
    const result = await client.searchDestination('Dubai')
    expect(result.data).toBeNull()
    expect(result.error?.code).toBe('BOOKING_INVALID_KEY')
  })
})

describe('resolveBookingDestination', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('returns numeric dest ids without calling the API', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const client = new BookingComApiClient({
      apiKey: 'test-key',
      baseUrl: 'https://test.api.com/api/v1',
      rapidApiHost: 'booking-com15.p.rapidapi.com',
      timeout: 5000,
      maxRetries: 0,
    })
    const resolved = await resolveBookingDestination(client, '-246227')
    expect(resolved.destination?.destId).toBe(-246227)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('resolves Arabic city names via searchDestination', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse(SAMPLE_DESTINATIONS)))
    const client = new BookingComApiClient({
      apiKey: 'test-key',
      baseUrl: 'https://test.api.com/api/v1',
      rapidApiHost: 'booking-com15.p.rapidapi.com',
      timeout: 5000,
      maxRetries: 0,
    })
    const resolved = await resolveBookingDestination(client, 'طوكيو')
    expect(resolved.error).toBeNull()
    expect(resolved.destination?.destId).toBe(-246227)
    expect(resolved.destination?.destType).toBe('city')
  })

  it('returns NOT_FOUND when API returns empty list (no hard-coded fallback city)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse({ status: true, data: [] })))
    const client = new BookingComApiClient({
      apiKey: 'test-key',
      baseUrl: 'https://test.api.com/api/v1',
      rapidApiHost: 'booking-com15.p.rapidapi.com',
      timeout: 5000,
      maxRetries: 0,
    })
    const resolved = await resolveBookingDestination(client, 'SomewhereUnknown')
    expect(resolved.destination).toBeNull()
    expect(resolved.error?.code).toBe('BOOKING_DEST_NOT_FOUND')
  })
})

describe('BookingComAdapter destination wiring', () => {
  afterEach(() => vi.unstubAllGlobals())

  const MOCK_REQUEST: ProviderRequest = {
    search: {
      destination: 'طوكيو',
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

  const hotelResponse: BookingComSearchResponse = {
    result: [{
      hotel_id: 1,
      hotel_name: 'Test Hotel Tokyo',
      hotel_class: 4,
      review_score: 8.5,
      review_nr: 100,
      address: '1 Test St',
      city: 'Tokyo',
      url: 'https://example.com/hotel',
      photos: [],
      facilities: [],
      room_data: [],
      product_price: '500',
      currency_code: 'SAR',
      product_price_breakdown: { product_price: '500', gross_amount_per_night: [{ amount: '50' }] },
      mealplan_included: false,
      key_collection_info: { checkin_from: '15:00', checkout_to: '11:00' },
      cancellation: 'free',
      distance_to_city_center_km: 1,
      latitude: '35.0',
      longitude: '139.0',
    }],
    total_count: 1,
  }

  it('looks up dest_id then searches hotels with that id', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes('searchDestination')) {
        return Promise.resolve(mockFetchResponse(SAMPLE_DESTINATIONS))
      }
      return Promise.resolve(mockFetchResponse(hotelResponse))
    })
    vi.stubGlobal('fetch', fetchMock)

    const adapter = new BookingComAdapter({
      apiKey: 'test-key',
      baseUrl: 'https://test.api.com/api/v1',
      rapidApiHost: 'booking-com15.p.rapidapi.com',
      timeout: 5000,
      maxRetries: 0,
    })
    const result = await adapter.searchHotels(MOCK_REQUEST)
    expect(result.success).toBe(true)
    expect(result.data?.length).toBe(1)

    expect(fetchMock).toHaveBeenCalled()
    const destUrl = String(fetchMock.mock.calls[0][0])
    expect(destUrl).toContain('searchDestination')
    expect(destUrl).toContain('query=Tokyo')

    const hotelUrl = String(fetchMock.mock.calls[1][0])
    expect(hotelUrl).toContain('dest_id=-246227')
  })

  it('fails closed when destination cannot be resolved (no Tokyo hard-code)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse({ status: true, data: [] })))
    const adapter = new BookingComAdapter({
      apiKey: 'test-key',
      baseUrl: 'https://test.api.com/api/v1',
      rapidApiHost: 'booking-com15.p.rapidapi.com',
      timeout: 5000,
      maxRetries: 0,
    })
    const result = await adapter.searchHotels({
      ...MOCK_REQUEST,
      search: { ...MOCK_REQUEST.search, destination: 'مدينة غير معروفة' },
    })
    expect(result.success).toBe(false)
    expect(result.errors[0].code).toBe('BOOKING_DEST_NOT_FOUND')
  })
})
