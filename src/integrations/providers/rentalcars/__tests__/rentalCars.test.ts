import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { RentalCarsApiClient, type RentalCarsSearchResponse, type RentalCarSearchQuery } from '../rentalCarsApiClient'
import { RentalCarsComAdapter, type RentalCarsAdapterConfig } from '../rentalCarsComAdapter'
import {
  normalizeRentalCar,
  normalizeRentalCarsResponse,
  mapCategory,
  mapTransmission,
  mapFuelType,
} from '../rentalCarNormalization'
import { MockRentalCarAdapter } from '../../../adapters/MockRentalCarAdapter'
import { createRentalCarService } from '../../rentalCarService'
import { getProviderRegistry, resetProviderRegistry } from '../../../registry/providerRegistry'
import { clearConfigCache } from '../../../config/environment'
import { getProviderHealthService, resetHealthService } from '../../../health/providerHealth'
import type { ProviderRequest } from '../../../../utils/contracts/providers/base'
import type { RentalCarsSearchResult } from '../rentalCarsApiClient'

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

const SAMPLE_RESULT: RentalCarsSearchResult = {
  vehicle_id: 'veh-001',
  vendor_name: 'Toyota Rent a Car',
  vendor_id: 'toyota',
  vehicle_name: 'Toyota Corolla',
  category: 'compact',
  transmission: 'automatic',
  fuel_type: 'petrol',
  seats: 5,
  doors: 4,
  air_conditioning: true,
  luggage_large: 2,
  luggage_small: 2,
  price_per_day: '45.00',
  currency: 'SAR',
  total_price: '450.00',
  pickup_location: 'NRT Airport Terminal 1',
  dropoff_location: 'NRT Airport Terminal 1',
  unlimited_mileage: true,
  insurance_included: true,
  rating: 4.5,
  image_url: 'https://example.com/car1.jpg',
  booking_url: 'https://example.com/book/veh-001',
}

const SAMPLE_SUV_RESULT: RentalCarsSearchResult = {
  ...SAMPLE_RESULT,
  vehicle_id: 'veh-002',
  vendor_name: 'Nissan Rent a Car',
  vehicle_name: 'Nissan X-Trail',
  category: 'suv',
  transmission: 'manual',
  fuel_type: 'hybrid',
  seats: 7,
  doors: 5,
  luggage_large: 3,
  luggage_small: 3,
  total_price: '780.00',
  unlimited_mileage: false,
  insurance_included: false,
  rating: 4.3,
  image_url: 'https://example.com/car2.jpg',
  booking_url: 'https://example.com/book/veh-002',
}

const SAMPLE_RESPONSE: RentalCarsSearchResponse = {
  results: [SAMPLE_RESULT, SAMPLE_SUV_RESULT],
  total_count: 2,
  search_id: 'search-123',
}

function createAdapterConfig(overrides: Partial<RentalCarsAdapterConfig> = {}): RentalCarsAdapterConfig {
  return {
    apiKey: 'test-api-key',
    baseUrl: 'https://test.rental-api.com/api/v1',
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

describe('Rental Car Normalization', () => {
  it('normalizes a RentalCars result into Vehicle model', () => {
    const vehicle = normalizeRentalCar(SAMPLE_RESULT, 'rentalcars-001', '2026-10-15', '2026-10-25')
    expect(vehicle.provider).toBe('rentalcars')
    expect(vehicle.providerId).toBe('rentalcars-001')
    expect(vehicle.company).toBe('Toyota Rent a Car')
    expect(vehicle.vehicleName).toBe('Toyota Corolla')
    expect(vehicle.category).toBe('compact')
    expect(vehicle.transmission).toBe('automatic')
    expect(vehicle.fuelType).toBe('petrol')
    expect(vehicle.seats).toBe(5)
    expect(vehicle.doors).toBe(4)
    expect(vehicle.airConditioning).toBe(true)
    expect(vehicle.luggageLarge).toBe(2)
    expect(vehicle.luggageSmall).toBe(2)
    expect(vehicle.price).toBe(450)
    expect(vehicle.currency).toBe('SAR')
    expect(vehicle.pickupLocation).toBe('NRT Airport Terminal 1')
    expect(vehicle.dropoffLocation).toBe('NRT Airport Terminal 1')
    expect(vehicle.pickupDate).toBe('2026-10-15')
    expect(vehicle.dropoffDate).toBe('2026-10-25')
    expect(vehicle.unlimitedMileage).toBe(true)
    expect(vehicle.insuranceIncluded).toBe(true)
    expect(vehicle.rating).toBe(4.5)
    expect(vehicle.image).toBe('https://example.com/car1.jpg')
    expect(vehicle.bookingUrl).toBe('https://example.com/book/veh-001')
  })

  it('normalizes SUV with different attributes', () => {
    const vehicle = normalizeRentalCar(SAMPLE_SUV_RESULT, 'rentalcars-001', '2026-10-15', '2026-10-25')
    expect(vehicle.category).toBe('suv')
    expect(vehicle.transmission).toBe('manual')
    expect(vehicle.fuelType).toBe('hybrid')
    expect(vehicle.seats).toBe(7)
    expect(vehicle.unlimitedMileage).toBe(false)
    expect(vehicle.insuranceIncluded).toBe(false)
  })

  it('maps category strings correctly', () => {
    expect(mapCategory('mini')).toBe('mini')
    expect(mapCategory('economy')).toBe('economy')
    expect(mapCategory('compact')).toBe('compact')
    expect(mapCategory('intermediate')).toBe('midsize')
    expect(mapCategory('full-size')).toBe('fullsize')
    expect(mapCategory('premium')).toBe('luxury')
    expect(mapCategory('minivan')).toBe('van')
    expect(mapCategory(undefined)).toBe('economy')
    expect(mapCategory('unknown')).toBe('economy')
  })

  it('maps transmission types correctly', () => {
    expect(mapTransmission('automatic')).toBe('automatic')
    expect(mapTransmission('auto')).toBe('automatic')
    expect(mapTransmission('manual')).toBe('manual')
    expect(mapTransmission(undefined)).toBe('manual')
  })

  it('maps fuel types correctly', () => {
    expect(mapFuelType('petrol')).toBe('petrol')
    expect(mapFuelType('diesel')).toBe('diesel')
    expect(mapFuelType('hybrid')).toBe('hybrid')
    expect(mapFuelType('electric')).toBe('electric')
    expect(mapFuelType('EV')).toBe('electric')
    expect(mapFuelType(undefined)).toBe('petrol')
    expect(mapFuelType('unknown')).toBe('petrol')
  })

  it('normalizes a full response into Vehicle[]', () => {
    const vehicles = normalizeRentalCarsResponse(SAMPLE_RESPONSE, 'rentalcars-001', '2026-10-15', '2026-10-25')
    expect(vehicles.length).toBe(2)
    expect(vehicles[0].vehicleName).toBe('Toyota Corolla')
    expect(vehicles[1].vehicleName).toBe('Nissan X-Trail')
  })

  it('handles empty response gracefully', () => {
    expect(normalizeRentalCarsResponse({ results: [], total_count: 0, search_id: 'x' }, 'test', '', '').length).toBe(0)
  })

  it('handles missing fields gracefully', () => {
    const minimal: RentalCarsSearchResult = {
      vehicle_id: '', vendor_name: '', vendor_id: '', vehicle_name: '', category: '',
      transmission: '', fuel_type: '', seats: 0, doors: 0, air_conditioning: false,
      luggage_large: 0, luggage_small: 0, price_per_day: '', currency: '', total_price: '',
      pickup_location: '', dropoff_location: '', unlimited_mileage: false,
      insurance_included: false, rating: 0, image_url: '', booking_url: '',
    }
    const vehicle = normalizeRentalCar(minimal, 'test', '2026-10-15', '2026-10-25')
    expect(vehicle.company).toBe('Unknown')
    expect(vehicle.vehicleName).toBe('Unknown Vehicle')
    expect(vehicle.category).toBe('economy')
    expect(vehicle.transmission).toBe('manual')
    expect(vehicle.fuelType).toBe('petrol')
    expect(vehicle.seats).toBe(0)
    expect(vehicle.price).toBe(0)
  })

  it('falls back to price_per_day when total_price is missing', () => {
    const noTotal: RentalCarsSearchResult = { ...SAMPLE_RESULT, total_price: '' }
    const vehicle = normalizeRentalCar(noTotal, 'test', '', '')
    expect(vehicle.price).toBe(45)
  })
})

// ── Adapter Tests ────────────────────────────────────────────────────────────

describe('RentalCarsComAdapter', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('returns successful ProviderResult with Vehicle[]', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse(SAMPLE_RESPONSE)))

    const adapter = new RentalCarsComAdapter(createAdapterConfig())
    const result = await adapter.searchRentalCars(MOCK_REQUEST)

    expect(result.success).toBe(true)
    expect(result.data).not.toBeNull()
    expect(result.data!.length).toBe(2)
    expect(result.source).toBe('rentalcars')
    expect(result.providerId).toBe('rentalcars-001')
  })

  it('tracks diagnostics after search', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse(SAMPLE_RESPONSE)))

    const adapter = new RentalCarsComAdapter(createAdapterConfig())
    await adapter.searchRentalCars(MOCK_REQUEST)
    const diag = adapter.getDiagnostics()

    expect(diag.lastResponseCount).toBe(2)
    expect(diag.lastLatency).toBeGreaterThanOrEqual(0)
    expect(diag.lastError).toBeNull()
    expect(diag.lastRequestAt).not.toBeNull()
  })

  it('returns error result on 401 invalid key', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse({ error: 'Unauthorized' }, 401)))

    const adapter = new RentalCarsComAdapter(createAdapterConfig({ apiKey: 'bad-key', maxRetries: 0 }))
    const result = await adapter.searchRentalCars(MOCK_REQUEST)

    expect(result.success).toBe(false)
    expect(result.data).toBeNull()
    expect(result.errors[0].code).toBe('RENTAL_INVALID_KEY')
    expect(result.errors[0].retryable).toBe(false)
  })

  it('returns error result on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    const adapter = new RentalCarsComAdapter(createAdapterConfig({ maxRetries: 0 }))
    const result = await adapter.searchRentalCars(MOCK_REQUEST)

    expect(result.success).toBe(false)
    expect(result.errors[0].code).toBe('RENTAL_NETWORK_FAILURE')
  })

  it('returns error result on 429 quota exceeded', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse({ error: 'Too many requests' }, 429)))

    const adapter = new RentalCarsComAdapter(createAdapterConfig({ maxRetries: 0 }))
    const result = await adapter.searchRentalCars(MOCK_REQUEST)

    expect(result.success).toBe(false)
    expect(result.errors[0].code).toBe('RENTAL_RATE_LIMITED')
    expect(result.errors[0].retryable).toBe(true)
  })

  it('has correct metadata', () => {
    const adapter = new RentalCarsComAdapter(createAdapterConfig())
    expect(adapter.metadata.type).toBe('rental-car')
    expect(adapter.metadata.id).toBe('rentalcars-001')
  })

  it('returns capabilities with booking support', () => {
    const adapter = new RentalCarsComAdapter(createAdapterConfig())
    const caps = adapter.getCapabilities()
    expect(caps.supportsBooking).toBe(true)
    expect(caps.supportsCancellation).toBe(true)
  })
})

// ── API Client Tests ─────────────────────────────────────────────────────────

describe('RentalCarsApiClient', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('retries on 500 server error', async () => {
    let calls = 0
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      calls++
      if (calls < 3) return Promise.resolve(mockFetchResponse({ error: 'Server error' }, 500))
      return Promise.resolve(mockFetchResponse(SAMPLE_RESPONSE))
    }))

    const client = new RentalCarsApiClient({
      apiKey: 'test', baseUrl: 'https://test.api.com/api/v1',
      timeout: 5000, maxRetries: 2,
    })
    const result = await client.searchRentalCars({
      pickupLocation: 'NRT', dropoffLocation: 'NRT',
      pickupDate: '2026-10-15', dropoffDate: '2026-10-25',
      pickupTime: '10:00', dropoffTime: '10:00',
      driverAge: 30, currency: 'SAR', maxResults: 10,
    } as RentalCarSearchQuery)

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

    const client = new RentalCarsApiClient({
      apiKey: 'bad', baseUrl: 'https://test.api.com/api/v1',
      timeout: 5000, maxRetries: 2,
    })
    const result = await client.searchRentalCars({
      pickupLocation: 'NRT', dropoffLocation: 'NRT',
      pickupDate: '2026-10-15', dropoffDate: '2026-10-25',
      pickupTime: '10:00', dropoffTime: '10:00',
      driverAge: 30, currency: 'SAR', maxResults: 10,
    } as RentalCarSearchQuery)

    expect(result.data).toBeNull()
    expect(result.error!.code).toBe('RENTAL_INVALID_KEY')
    expect(calls).toBe(1)
  })
})

// ── Mock Adapter Tests ───────────────────────────────────────────────────────

describe('MockRentalCarAdapter', () => {
  it('returns successful result with Vehicle[]', async () => {
    const adapter = new MockRentalCarAdapter()
    const result = await adapter.searchRentalCars(MOCK_REQUEST)

    expect(result.success).toBe(true)
    expect(result.data).not.toBeNull()
    expect(result.data!.length).toBe(3)
    expect(result.source).toBe('mock')
    expect(result.data![0].provider).toBe('mock')
    expect(result.data![0].company).toBe('Toyota Rent a Car')
  })

  it('returns Moroccan rental companies for Morocco destinations', async () => {
    const adapter = new MockRentalCarAdapter()
    for (const destination of ['Morocco', 'Marrakech', 'Casablanca', 'Agadir', 'Rabat']) {
      const result = await adapter.searchRentalCars({
        search: { ...MOCK_REQUEST.search, destination },
      })
      expect(result.success).toBe(true)
      expect(result.data?.map((v) => v.company)).toEqual([
        'Medloc Car Rental',
        'First Car Morocco',
        'Europcar Morocco',
      ])
      expect(result.data?.some((v) => /Tokyo|Toyota Rent a Car/i.test(v.company))).toBe(false)
    }
  })

  it('has correct metadata', () => {
    const adapter = new MockRentalCarAdapter()
    expect(adapter.metadata.id).toBe('mock-rental-001')
    expect(adapter.metadata.type).toBe('rental-car')
  })
})

// ── Fallback Tests ───────────────────────────────────────────────────────────

describe('RentalCarService Fallback', () => {
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

  it('falls back to mock when auth fails', async () => {
    vi.stubEnv('VITE_RENTAL_PROVIDER', 'rentalcars')
    vi.stubEnv('VITE_RENTAL_API_KEY', 'bad-key')
    resetProviderRegistry()
    clearConfigCache()

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse({ error: 'Unauthorized' }, 401)))

    const service = createRentalCarService()
    const model = await service.searchRentalCars(MOCK_REQUEST)

    expect(model.source).toBe('fallback')
    expect(model.vehicles.length).toBeGreaterThan(0)
    expect(model.error).not.toBeNull()
  })

  it('falls back to mock on network failure', async () => {
    vi.stubEnv('VITE_RENTAL_PROVIDER', 'rentalcars')
    vi.stubEnv('VITE_RENTAL_API_KEY', 'test-key')
    resetProviderRegistry()
    clearConfigCache()

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    const service = createRentalCarService()
    const model = await service.searchRentalCars(MOCK_REQUEST)

    expect(model.source).toBe('fallback')
    expect(model.vehicles.length).toBeGreaterThan(0)
  })

  it('falls back to mock on quota exceeded', async () => {
    vi.stubEnv('VITE_RENTAL_PROVIDER', 'rentalcars')
    vi.stubEnv('VITE_RENTAL_API_KEY', 'test-key')
    resetProviderRegistry()
    clearConfigCache()

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse({ error: 'Too many requests' }, 429)))

    const service = createRentalCarService()
    const model = await service.searchRentalCars(MOCK_REQUEST)

    expect(model.source).toBe('fallback')
    expect(model.vehicles.length).toBeGreaterThan(0)
  })

  it('returns mock source by default', async () => {
    const service = createRentalCarService()
    const model = await service.searchRentalCars(MOCK_REQUEST)

    expect(model.source).toBe('mock')
    expect(model.vehicles.length).toBeGreaterThan(0)
    expect(model.error).toBeNull()
  })

  it('returns real data when Rental Cars succeeds', async () => {
    vi.stubEnv('VITE_RENTAL_PROVIDER', 'rentalcars')
    vi.stubEnv('VITE_RENTAL_API_KEY', 'valid-key')
    resetProviderRegistry()
    clearConfigCache()

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse(SAMPLE_RESPONSE)))

    const service = createRentalCarService()
    const model = await service.searchRentalCars(MOCK_REQUEST)

    expect(model.source).toBe('real')
    expect(model.vehicles.length).toBe(2)
    expect(model.error).toBeNull()
  })
})

// ── Registry Tests ───────────────────────────────────────────────────────────

describe('Provider Registry — Rental Car', () => {
  beforeEach(() => {
    resetProviderRegistry()
    clearConfigCache()
  })
  afterEach(() => {
    resetProviderRegistry()
    clearConfigCache()
    vi.unstubAllEnvs()
  })

  it('returns MockRentalCarAdapter by default', () => {
    const registry = getProviderRegistry()
    const rental = registry.getRentalCar()
    expect(rental).not.toBeNull()
    expect(rental!.metadata.id).toBe('mock-rental-001')
  })

  it('returns RentalCarsComAdapter when rentalcars is configured', () => {
    vi.stubEnv('VITE_RENTAL_PROVIDER', 'rentalcars')
    vi.stubEnv('VITE_RENTAL_API_KEY', 'test-key')
    resetProviderRegistry()
    clearConfigCache()

    const registry = getProviderRegistry()
    const rental = registry.getRentalCar()
    expect(rental).not.toBeNull()
    expect(rental!.metadata.id).toBe('rentalcars-001')
  })

  it('returns null for rentalcars when API key missing', () => {
    vi.stubEnv('VITE_RENTAL_PROVIDER', 'rentalcars')
    vi.stubEnv('VITE_RENTAL_API_KEY', '')
    resetProviderRegistry()
    clearConfigCache()

    const registry = getProviderRegistry()
    expect(registry.getRentalCar()).toBeNull()
  })

  it('can disable rental car provider', () => {
    vi.stubEnv('VITE_RENTAL_CAR_ENABLED', 'false')
    resetProviderRegistry()
    clearConfigCache()

    const registry = getProviderRegistry()
    expect(registry.getRentalCar()).toBeNull()
    expect(registry.isEnabled('rental-car')).toBe(false)
  })
})

// ── Diagnostics Tests ────────────────────────────────────────────────────────

describe('Diagnostics — Rental Car', () => {
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

  it('reports mock mode for default rental car provider', () => {
    const service = getProviderHealthService()
    const rental = service.checkByDomain('rental-car')
    expect(rental).toBeDefined()
    expect(rental!.mode).toBe('mock')
    expect(rental!.adapter).toBe('mock')
    expect(rental!.lastResponseCount).toBeNull()
    expect(rental!.lastRequestAt).toBeNull()
  })

  it('reports real mode for RentalCars.com', () => {
    vi.stubEnv('VITE_RENTAL_PROVIDER', 'rentalcars')
    vi.stubEnv('VITE_RENTAL_API_KEY', 'test-key')
    resetProviderRegistry()
    clearConfigCache()
    resetHealthService()

    const service = getProviderHealthService()
    const rental = service.checkByDomain('rental-car')
    expect(rental).toBeDefined()
    expect(rental!.mode).toBe('real')
    expect(rental!.adapter).toBe('rentalcars')
    expect(rental!.lastResponseCount).toBeNull()
  })

  it('reports missing API key error when not configured', () => {
    vi.stubEnv('VITE_RENTAL_PROVIDER', 'rentalcars')
    vi.stubEnv('VITE_RENTAL_API_KEY', '')
    resetProviderRegistry()
    clearConfigCache()
    resetHealthService()

    const service = getProviderHealthService()
    const rental = service.checkByDomain('rental-car')
    expect(rental).toBeNull()
  })
})
