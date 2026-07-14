import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { BookingComApiClient, type BookingComSearchResponse, type HotelSearchQuery } from '../bookingComApiClient'
import { BookingComAdapter, type BookingComAdapterConfig } from '../bookingComAdapter'
import {
  normalizeBookingComHotel,
  normalizeBookingComToHotelOffer,
  normalizeBookingComResponse,
  normalizeToHotelModel,
  type Hotel,
} from '../hotelNormalization'
import { createHotelService } from '../../hotelService'
import { getProviderRegistry, resetProviderRegistry } from '../../../registry/providerRegistry'
import { clearConfigCache } from '../../../config/environment'
import { getProviderHealthService, resetHealthService } from '../../../health/providerHealth'
import type { ProviderRequest } from '../../../../utils/contracts/providers/base'
import type { BookingComHotelResult } from '../bookingComApiClient'

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

const SAMPLE_HOTEL_RESULT: BookingComHotelResult = {
  hotel_id: 123456,
  hotel_name: 'Hilton Tokyo Odaiba',
  hotel_class: 5,
  review_score: 9.2,
  review_nr: 1500,
  address: '1-9-1 Daiba, Odaiba, Tokyo',
  city: 'Tokyo',
  url: 'https://www.booking.com/hotel/jp/hilton-tokyo-odaiba.html',
  photos: [
    { url_original: 'https://example.com/orig1.jpg', url_max1080: 'https://example.com/1080-1.jpg', url_1440: 'https://example.com/1440-1.jpg', photo_id: 1 },
    { url_original: 'https://example.com/orig2.jpg', url_max1080: 'https://example.com/1080-2.jpg', url_1440: 'https://example.com/1440-2.jpg', photo_id: 2 },
  ],
  facilities: [
    { hotel_facility_id: 1, name: 'Free WiFi' },
    { hotel_facility_id: 2, name: ' Swimming Pool' },
    { hotel_facility_id: 3, name: 'Fitness Centre' },
  ],
  room_data: [
    {
      room_id: 101,
      room_name: 'King Bay View Room',
      room_config: '1 King Bed',
      bed_configurations: [{ bed_types: [{ name: 'King', count: 1 }] }],
    },
  ],
  product_price: '850.00',
  currency_code: 'SAR',
  product_price_breakdown: {
    product_price: '850.00',
    gross_amount_per_night: [{ amount: '1100.00' }],
  },
  mealplan_included: true,
  key_collection_info: { checkin_from: '15:00', checkout_to: '11:00' },
  cancellation: 'FREE cancellation before October 10',
  distance_to_city_center_km: 3.5,
  latitude: '35.6195',
  longitude: '139.7769',
}

const SAMPLE_BUDGET_HOTEL_RESULT: BookingComHotelResult = {
  ...SAMPLE_HOTEL_RESULT,
  hotel_id: 789012,
  hotel_name: 'Toyoko Inn Asakusa',
  hotel_class: 3,
  review_score: 8.1,
  product_price: '350.00',
  product_price_breakdown: {
    product_price: '350.00',
    gross_amount_per_night: [{ amount: '350.00' }],
  },
  mealplan_included: false,
  cancellation: 'Non-refundable',
  distance_to_city_center_km: 1.2,
  room_data: [
    {
      room_id: 201,
      room_name: 'Single Room',
      room_config: '1 Single Bed',
      bed_configurations: [{ bed_types: [{ name: 'Single', count: 1 }] }],
    },
  ],
}

const SAMPLE_RESPONSE: BookingComSearchResponse = {
  result: [SAMPLE_HOTEL_RESULT, SAMPLE_BUDGET_HOTEL_RESULT],
  total_count: 2,
}

function createAdapterConfig(overrides: Partial<BookingComAdapterConfig> = {}): BookingComAdapterConfig {
  return {
    apiKey: 'test-api-key',
    baseUrl: 'https://test.booking-api.com/api/v1',
    rapidApiHost: 'booking-com15.p.rapidapi.com',
    timeout: 5000,
    maxRetries: 2,
    ...overrides,
  }
}

function mockFetchResponse(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
    text: async () => JSON.stringify(data),
  } as Response
}

// ── Normalization Tests ──────────────────────────────────────────────────────

describe('Hotel Normalization', () => {
  it('normalizes a Booking.com result into unified Hotel model', () => {
    const hotel: Hotel = normalizeBookingComHotel(SAMPLE_HOTEL_RESULT, 'booking-hotel-001')
    expect(hotel.name).toBe('Hilton Tokyo Odaiba')
    expect(hotel.rating).toBe(9.2)
    expect(hotel.stars).toBe(5)
    expect(hotel.price).toBe(850)
    expect(hotel.currency).toBe('SAR')
    expect(hotel.latitude).toBe(35.6195)
    expect(hotel.longitude).toBe(139.7769)
    expect(hotel.images.length).toBe(2)
    expect(hotel.images[0]).toBe('https://example.com/1080-1.jpg')
    expect(hotel.amenities).toEqual(['Free WiFi', ' Swimming Pool', 'Fitness Centre'])
    expect(hotel.roomType).toBe('King Bay View Room (1x King)')
    expect(hotel.breakfastIncluded).toBe(true)
    expect(hotel.refundable).toBe(true)
    expect(hotel.distanceFromCenter).toBe(3.5)
    expect(hotel.provider).toBe('booking')
    expect(hotel.providerId).toBe('booking-hotel-001')
    expect(hotel.bookingUrl).toBe('https://www.booking.com/hotel/jp/hilton-tokyo-odaiba.html')
  })

  it('normalizes into existing HotelOffer domain model', () => {
    const offer = normalizeBookingComToHotelOffer(SAMPLE_HOTEL_RESULT, 'booking-hotel-001', '2026-10-15', '2026-10-25')
    expect(offer.id).toBe('123456')
    expect(offer.providerId).toBe('booking-hotel-001')
    expect(offer.title).toBe('Hilton Tokyo Odaiba')
    expect(offer.currency).toBe('SAR')
    expect(offer.price).toBe(850)
    expect(offer.originalPrice).toBe(1100)
    expect(offer.rating).toBe(9.2)
    expect(offer.hotelStars).toBe(5)
    expect(offer.location).toBe('1-9-1 Daiba, Odaiba, Tokyo')
    expect(offer.area).toBe('Tokyo')
    expect(offer.checkIn).toBe('2026-10-15')
    expect(offer.checkOut).toBe('2026-10-25')
    expect(offer.breakfastIncluded).toBe(true)
    expect(offer.freeCancellation).toBe(true)
    expect(offer.amenities.length).toBe(3)
    expect(offer.roomTypes.length).toBe(1)
    expect(offer.roomTypes[0].name).toBe('King Bay View Room')
  })

  it('normalizes budget hotel with no discount and no breakfast', () => {
    const hotel = normalizeBookingComHotel(SAMPLE_BUDGET_HOTEL_RESULT, 'booking-hotel-001')
    expect(hotel.breakfastIncluded).toBe(false)
    expect(hotel.refundable).toBe(false)
    expect(hotel.stars).toBe(3)
    expect(hotel.distanceFromCenter).toBe(1.2)

    const offer = normalizeBookingComToHotelOffer(SAMPLE_BUDGET_HOTEL_RESULT, 'booking-hotel-001', '2026-10-15', '2026-10-25')
    expect(offer.originalPrice).toBeNull()
    expect(offer.breakfastIncluded).toBe(false)
    expect(offer.freeCancellation).toBe(false)
  })

  it('normalizes a full response into array of HotelOffers', () => {
    const offers = normalizeBookingComResponse(SAMPLE_RESPONSE, 'booking-hotel-001', '2026-10-15', '2026-10-25')
    expect(offers.length).toBe(2)
    expect(offers[0].title).toBe('Hilton Tokyo Odaiba')
    expect(offers[1].title).toBe('Toyoko Inn Asakusa')
  })

  it('normalizes a full response into array of Hotel models', () => {
    const hotels = normalizeToHotelModel(SAMPLE_RESPONSE, 'booking-hotel-001')
    expect(hotels.length).toBe(2)
    expect(hotels[0].name).toBe('Hilton Tokyo Odaiba')
    expect(hotels[1].name).toBe('Toyoko Inn Asakusa')
  })

  it('handles empty response gracefully', () => {
    expect(normalizeBookingComResponse({ result: [], total_count: 0 }, 'test', '', '').length).toBe(0)
    expect(normalizeToHotelModel({ result: [], total_count: 0 }, 'test').length).toBe(0)
  })

  it('handles missing fields gracefully', () => {
    const minimal: BookingComHotelResult = {
      hotel_id: 1, hotel_name: '', hotel_class: 0, review_score: 0, review_nr: 0,
      address: '', city: '', url: '', photos: [], facilities: [], room_data: [],
      product_price: '', currency_code: '', product_price_breakdown: { product_price: '', gross_amount_per_night: [] },
      mealplan_included: false, key_collection_info: { checkin_from: '', checkout_to: '' },
      cancellation: '', distance_to_city_center_km: 0, latitude: '', longitude: '',
    }
    const hotel = normalizeBookingComHotel(minimal, 'test')
    expect(hotel.name).toBe('Unknown Hotel')
    expect(hotel.price).toBe(0)
    expect(hotel.images.length).toBe(0)
    expect(hotel.amenities.length).toBe(0)
    expect(hotel.roomType).toBe('Standard Room')
    expect(hotel.latitude).toBe(0)
    expect(hotel.longitude).toBe(0)
  })

  it('detects refundable from cancellation text', () => {
    const free: BookingComHotelResult = { ...SAMPLE_HOTEL_RESULT, cancellation: 'FREE cancellation' }
    const nonRefund: BookingComHotelResult = { ...SAMPLE_HOTEL_RESULT, cancellation: 'Non-refundable' }
    expect(normalizeBookingComHotel(free, 'test').refundable).toBe(true)
    expect(normalizeBookingComHotel(nonRefund, 'test').refundable).toBe(false)
  })

  it('caps images to 5', () => {
    const manyPhotos: BookingComHotelResult = {
      ...SAMPLE_HOTEL_RESULT,
      photos: Array.from({ length: 10 }, (_, i) => ({
        url_original: `https://example.com/o${i}.jpg`,
        url_max1080: `https://example.com/m${i}.jpg`,
        url_1440: `https://example.com/p${i}.jpg`,
        photo_id: i,
      })),
    }
    const hotel = normalizeBookingComHotel(manyPhotos, 'test')
    expect(hotel.images.length).toBe(5)
  })
})

// ── Adapter Tests ────────────────────────────────────────────────────────────

describe('BookingComAdapter', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('returns successful ProviderResult with HotelOffer[]', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse(SAMPLE_RESPONSE)))

    const adapter = new BookingComAdapter(createAdapterConfig())
    const result = await adapter.searchHotels(MOCK_REQUEST)

    expect(result.success).toBe(true)
    expect(result.data).not.toBeNull()
    expect(result.data!.length).toBe(2)
    expect(result.source).toBe('booking')
    expect(result.providerId).toBe('booking-hotel-001')
  })

  it('returns Hotel[] from searchHotelsAsHotelModel', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse(SAMPLE_RESPONSE)))

    const adapter = new BookingComAdapter(createAdapterConfig())
    const result = await adapter.searchHotelsAsHotelModel(MOCK_REQUEST)

    expect(result.success).toBe(true)
    expect(result.data!.length).toBe(2)
    expect(result.data![0].name).toBe('Hilton Tokyo Odaiba')
    expect(result.data![0].provider).toBe('booking')
  })

  it('tracks diagnostics after search', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse(SAMPLE_RESPONSE)))

    const adapter = new BookingComAdapter(createAdapterConfig())
    await adapter.searchHotels(MOCK_REQUEST)
    const diag = adapter.getDiagnostics()

    expect(diag.lastResponseCount).toBe(2)
    expect(diag.lastLatency).toBeGreaterThanOrEqual(0)
    expect(diag.lastError).toBeNull()
    expect(diag.lastRequestAt).not.toBeNull()
  })

  it('returns error result on 401 invalid key', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse({ error: 'Unauthorized' }, 401)))

    const adapter = new BookingComAdapter(createAdapterConfig({ apiKey: 'bad-key', maxRetries: 0 }))
    const result = await adapter.searchHotels(MOCK_REQUEST)

    expect(result.success).toBe(false)
    expect(result.data).toBeNull()
    expect(result.errors[0].code).toBe('BOOKING_INVALID_KEY')
    expect(result.errors[0].retryable).toBe(false)
  })

  it('returns error result on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    const adapter = new BookingComAdapter(createAdapterConfig({ maxRetries: 0 }))
    const result = await adapter.searchHotels(MOCK_REQUEST)

    expect(result.success).toBe(false)
    expect(result.errors[0].code).toBe('BOOKING_NETWORK_FAILURE')
  })

  it('returns error result on 429 quota exceeded', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse({ error: 'Too many requests' }, 429)))

    const adapter = new BookingComAdapter(createAdapterConfig({ maxRetries: 0 }))
    const result = await adapter.searchHotels(MOCK_REQUEST)

    expect(result.success).toBe(false)
    expect(result.errors[0].code).toBe('BOOKING_RATE_LIMITED')
    expect(result.errors[0].retryable).toBe(true)
  })

  it('has correct metadata', () => {
    const adapter = new BookingComAdapter(createAdapterConfig())
    expect(adapter.metadata.type).toBe('hotel')
    expect(adapter.metadata.id).toBe('booking-hotel-001')
  })

  it('returns capabilities with booking support', () => {
    const adapter = new BookingComAdapter(createAdapterConfig())
    const caps = adapter.getCapabilities()
    expect(caps.supportsBooking).toBe(true)
    expect(caps.supportsCancellation).toBe(true)
  })
})

// ── API Client Tests ─────────────────────────────────────────────────────────

describe('BookingComApiClient', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('retries on 500 server error', async () => {
    let calls = 0
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      calls++
      if (calls < 3) return Promise.resolve(mockFetchResponse({ error: 'Server error' }, 500))
      return Promise.resolve(mockFetchResponse(SAMPLE_RESPONSE))
    }))

    const client = new BookingComApiClient({
      apiKey: 'test', baseUrl: 'https://test.api.com/api/v1',
      rapidApiHost: 'booking-com15.p.rapidapi.com',
      timeout: 5000, maxRetries: 2,
    })
    const result = await client.searchHotels({
      destType: 'city', destId: -1746443, checkIn: '2026-10-15', checkOut: '2026-10-25',
      adults: 2, children: 0, rooms: 1, currency: 'SAR', maxResults: 10,
    } as HotelSearchQuery)

    expect(result.data).not.toBeNull()
    expect(result.attempts).toBe(3)
    expect(calls).toBe(3)
  })

  it('does not retry on 401', async () => {
    let calls = 0
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      calls++
      return Promise.resolve(mockFetchResponse({ error: 'Unauthorized' }, 401))
    }))

    const client = new BookingComApiClient({
      apiKey: 'bad', baseUrl: 'https://test.api.com/api/v1',
      rapidApiHost: 'booking-com15.p.rapidapi.com',
      timeout: 5000, maxRetries: 2,
    })
    const result = await client.searchHotels({
      destType: 'city', destId: 1, checkIn: '2026-10-15', checkOut: '2026-10-25',
      adults: 1, children: 0, rooms: 1, currency: 'SAR', maxResults: 10,
    } as HotelSearchQuery)

    expect(result.data).toBeNull()
    expect(result.error!.code).toBe('BOOKING_INVALID_KEY')
    expect(calls).toBe(1)
  })

  it('sends X-RapidAPI-Key and X-RapidAPI-Host headers from config', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockFetchResponse(SAMPLE_RESPONSE))
    vi.stubGlobal('fetch', fetchMock)

    const client = new BookingComApiClient({
      apiKey: 'rapid-secret',
      baseUrl: 'https://booking-com15.p.rapidapi.com/api/v1',
      rapidApiHost: 'booking-com15.p.rapidapi.com',
      timeout: 5000,
      maxRetries: 0,
    })
    await client.searchHotels({
      destType: 'city', destId: -1746443, checkIn: '2026-10-15', checkOut: '2026-10-25',
      adults: 2, children: 0, rooms: 1, currency: 'SAR', maxResults: 10,
    } as HotelSearchQuery)

    expect(fetchMock).toHaveBeenCalled()
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const headers = init.headers as Record<string, string>
    expect(headers['X-RapidAPI-Key']).toBe('rapid-secret')
    expect(headers['X-RapidAPI-Host']).toBe('booking-com15.p.rapidapi.com')
  })
})

// ── Fallback Tests ───────────────────────────────────────────────────────────

describe('HotelService Fallback', () => {
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

  it('falls back to mock when Booking auth fails', async () => {
    vi.stubEnv('VITE_BOOKING_PROVIDER', 'booking')
    vi.stubEnv('VITE_BOOKING_API_KEY', 'bad-key')
    resetProviderRegistry()
    clearConfigCache()

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse({ error: 'Unauthorized' }, 401)))

    const service = createHotelService()
    const model = await service.searchHotels(MOCK_REQUEST)

    expect(model.source).toBe('fallback')
    expect(model.offers.length).toBeGreaterThan(0)
    expect(model.error).not.toBeNull()
  })

  it('falls back to mock on network failure', async () => {
    vi.stubEnv('VITE_BOOKING_PROVIDER', 'booking')
    vi.stubEnv('VITE_BOOKING_API_KEY', 'test-key')
    resetProviderRegistry()
    clearConfigCache()

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    const service = createHotelService()
    const model = await service.searchHotels(MOCK_REQUEST)

    expect(model.source).toBe('fallback')
    expect(model.offers.length).toBeGreaterThan(0)
  })

  it('falls back to mock on quota exceeded', async () => {
    vi.stubEnv('VITE_BOOKING_PROVIDER', 'booking')
    vi.stubEnv('VITE_BOOKING_API_KEY', 'test-key')
    resetProviderRegistry()
    clearConfigCache()

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse({ error: 'Too many requests' }, 429)))

    const service = createHotelService()
    const model = await service.searchHotels(MOCK_REQUEST)

    expect(model.source).toBe('fallback')
    expect(model.offers.length).toBeGreaterThan(0)
  })

  it('returns mock source by default', async () => {
    const service = createHotelService()
    const model = await service.searchHotels(MOCK_REQUEST)

    expect(model.source).toBe('mock')
    expect(model.offers.length).toBeGreaterThan(0)
    expect(model.error).toBeNull()
  })

  it('returns real data when Booking succeeds', async () => {
    vi.stubEnv('VITE_BOOKING_PROVIDER', 'booking')
    vi.stubEnv('VITE_BOOKING_API_KEY', 'valid-key')
    resetProviderRegistry()
    clearConfigCache()

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse(SAMPLE_RESPONSE)))

    const service = createHotelService()
    const model = await service.searchHotels(MOCK_REQUEST)

    expect(model.source).toBe('real')
    expect(model.offers.length).toBe(2)
    expect(model.error).toBeNull()
  })
})

// ── Registry Tests ───────────────────────────────────────────────────────────

describe('Provider Registry — Hotel', () => {
  beforeEach(() => {
    resetProviderRegistry()
    clearConfigCache()
  })
  afterEach(() => {
    resetProviderRegistry()
    clearConfigCache()
    vi.unstubAllEnvs()
  })

  it('returns MockHotelAdapter by default', () => {
    const registry = getProviderRegistry()
    const hotel = registry.getHotel()
    expect(hotel).not.toBeNull()
    expect(hotel!.metadata.id).toBe('mock-hotel-001')
  })

  it('returns BookingComAdapter when booking is configured', () => {
    vi.stubEnv('VITE_BOOKING_PROVIDER', 'booking')
    vi.stubEnv('VITE_BOOKING_API_KEY', 'test-key')
    resetProviderRegistry()
    clearConfigCache()

    const registry = getProviderRegistry()
    const hotel = registry.getHotel()
    expect(hotel).not.toBeNull()
    expect(hotel!.metadata.id).toBe('booking-hotel-001')
  })

  it('auto-enables BookingComAdapter when VITE_RAPIDAPI_KEY is set (no explicit adapter)', () => {
    vi.stubEnv('VITE_RAPIDAPI_KEY', 'rapid-test-key')
    vi.stubEnv('VITE_BOOKING_HOST', 'booking-com15.p.rapidapi.com')
    resetProviderRegistry()
    clearConfigCache()

    const registry = getProviderRegistry()
    const hotel = registry.getHotel()
    expect(hotel).not.toBeNull()
    expect(hotel!.metadata.id).toBe('booking-hotel-001')
  })

  it('returns null for booking when API key missing', () => {
    vi.stubEnv('VITE_BOOKING_PROVIDER', 'booking')
    vi.stubEnv('VITE_BOOKING_API_KEY', '')
    vi.stubEnv('VITE_RAPIDAPI_KEY', '')
    resetProviderRegistry()
    clearConfigCache()

    const registry = getProviderRegistry()
    expect(registry.getHotel()).toBeNull()
  })

  it('can disable hotel provider', () => {
    vi.stubEnv('VITE_HOTEL_ENABLED', 'false')
    resetProviderRegistry()
    clearConfigCache()

    const registry = getProviderRegistry()
    expect(registry.getHotel()).toBeNull()
    expect(registry.isEnabled('hotel')).toBe(false)
  })
})

// ── Diagnostics Tests ────────────────────────────────────────────────────────

describe('Diagnostics — Hotel', () => {
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

  it('reports mock mode for default hotel provider', () => {
    const service = getProviderHealthService()
    const hotel = service.checkByDomain('hotel')
    expect(hotel).toBeDefined()
    expect(hotel!.mode).toBe('mock')
    expect(hotel!.adapter).toBe('mock')
    expect(hotel!.lastResponseCount).toBeNull()
    expect(hotel!.lastRequestAt).toBeNull()
  })

  it('reports real mode for Booking.com', () => {
    vi.stubEnv('VITE_BOOKING_PROVIDER', 'booking')
    vi.stubEnv('VITE_BOOKING_API_KEY', 'test-key')
    resetProviderRegistry()
    clearConfigCache()
    resetHealthService()

    const service = getProviderHealthService()
    const hotel = service.checkByDomain('hotel')
    expect(hotel).toBeDefined()
    expect(hotel!.mode).toBe('real')
    expect(hotel!.adapter).toBe('booking')
    expect(hotel!.lastResponseCount).toBeNull()
    expect(hotel!.lastRequestAt).toBeNull()
  })

  it('reports missing API key error when not configured', () => {
    vi.stubEnv('VITE_BOOKING_PROVIDER', 'booking')
    vi.stubEnv('VITE_BOOKING_API_KEY', '')
    resetProviderRegistry()
    clearConfigCache()
    resetHealthService()

    const service = getProviderHealthService()
    const hotel = service.checkByDomain('hotel')
    expect(hotel).toBeNull()
  })
})
